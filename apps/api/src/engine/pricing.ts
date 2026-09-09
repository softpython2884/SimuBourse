import { ENGINE, EVENTS, ZERO, bps, mulRatio, pctChange, type Fixed, type PriceTick } from '@alvora/shared';
import { random } from '../lib/random.js';
import type { AssetState, EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

/**
 * Absolute floor for any price. A price of zero would divide by zero everywhere
 * downstream (percentage change, portfolio weights, liquidation ratios) and can
 * never be recovered from by the multiplicative walk, so the simulation refuses
 * to produce one.
 */
const MIN_PRICE: Fixed = 1n;

/**
 * Share of a tick's random shock that comes from the asset class' common factor.
 * Real markets move together far more than independent walks would; without this
 * every instrument drifts on its own and the market never has a "red day".
 */
const MARKET_FACTOR_WEIGHT = 0.35;
const IDIOSYNCRATIC_WEIGHT = 1 - MARKET_FACTOR_WEIGHT;

/**
 * Per-tick decay of the accumulated event pressure.
 *
 * `AssetState.eventPressureBps` is a single scalar summing every live event on
 * the asset, so it cannot carry a per-event duration. The decay is calibrated on
 * the "moderate" event lifetime, which is the middle of the configured range:
 * the pressure loses half its strength over that many ticks, and the fraction
 * released each tick is exactly what the price absorbs, so an event's total
 * effect converges on its headline impact instead of being applied at once.
 */
const EVENT_HALF_LIFE_TICKS = Math.max(1, Math.round(EVENTS.durationMs.moderate / ENGINE.tickIntervalMs));
const EVENT_DECAY = Math.pow(0.5, 1 / EVENT_HALF_LIFE_TICKS);
const EVENT_RELEASE = 1 - EVENT_DECAY;

/** Below this the remaining pressure is dust; zero it so it cannot linger forever. */
const EVENT_PRESSURE_EPSILON = 0.25;

/**
 * Mean-reversion is computed from the gap to the anchor in bps. A brand-new asset
 * priced far from its anchor would otherwise generate an enormous pull on the
 * first tick, so the gap that feeds the pull is capped.
 */
const MAX_REVERSION_GAP_BPS = 50_000;

/** Sub-bps resolution kept when converting the float move to exact integer maths. */
const MOVE_SCALE = 1_000_000n; // bps × 100

const MS_PER_DAY = 86_400_000;

/**
 * The random walk that drives every quoted price.
 *
 * Four forces compose into one multiplicative move per tick: a geometric
 * Brownian step, a pull toward the asset's anchor, the price impact of real
 * player order flow, and the decaying pressure of market events. Order flow is
 * the one that makes the market multiplayer — a player who buys size genuinely
 * moves the print, and everyone else sees it on the same tick.
 */
export class PriceSimulator implements EngineModule {
  readonly name = 'pricing';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;

  private tickTimer: NodeJS.Timeout | null = null;
  private persistTimer: NodeJS.Timeout | null = null;
  private sequence = 0;
  private utcDay = Math.floor(Date.now() / MS_PER_DAY);
  private persisting = false;

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  start(): void {
    if (this.tickTimer) return;
    this.utcDay = Math.floor(Date.now() / MS_PER_DAY);
    this.tickTimer = setInterval(() => this.tick(), ENGINE.tickIntervalMs);
    // Writing every tick would be one UPDATE per asset per two seconds for no
    // benefit: the in-memory state is authoritative, the table is the durable copy.
    this.persistTimer = setInterval(() => void this.persist(), ENGINE.persistIntervalMs);
    this.ctx.log.info({ intervalMs: ENGINE.tickIntervalMs }, 'price simulator started');
  }

  async stop(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.tickTimer = null;
    this.persistTimer = null;
    await this.persist(true);
  }

  // -------------------------------------------------------------------------
  // The loop
  // -------------------------------------------------------------------------

  private tick(): void {
    const at = Date.now();
    this.rollDay(at);

    // One common factor per asset class, drawn once and shared by every member.
    const marketFactors = new Map<string, number>();
    const ticks: PriceTick[] = [];
    const moved: string[] = [];

    for (const state of this.engine.all()) {
      // A halted or delisted instrument keeps its last print until it reopens.
      if (!state.isTradable) continue;
      try {
        if (!this.step(state, marketFactors)) continue;
        ticks.push({
          ticker: state.ticker,
          price: state.price.toString(),
          changePct24h: pctChange(state.previousClose, state.price).toString(),
          volume24h: state.volume24h.toString(),
          at,
        });
        moved.push(state.ticker);
      } catch (error) {
        // One malformed asset must never stop the market for everyone else.
        this.ctx.log.error({ err: error, ticker: state.ticker }, 'price step failed');
      }
    }

    this.engine.markTick();

    if (ticks.length > 0) {
      this.sequence += 1;
      // A single event carrying every asset: one frame per tick on the wire
      // instead of N, which is what let the legacy SSE stream saturate a client.
      this.ctx.bus.emit('tick', { ticks, at, sequence: this.sequence });
    }

    for (const ticker of moved) this.fireTriggers(ticker);
  }

  /**
   * Advance one asset. Returns true when the price actually changed, so the tick
   * payload only carries assets a client needs to repaint.
   */
  private step(state: AssetState, marketFactors: Map<string, number>): boolean {
    const anchor = state.anchorPrice > ZERO ? state.anchorPrice : state.price;
    if (state.price <= ZERO || anchor <= ZERO) return false;

    let moveBps = state.driftBps;

    // --- Geometric Brownian step, correlated within the asset class ---------
    let factor = marketFactors.get(state.assetClass);
    if (factor === undefined) {
      factor = random.normal();
      marketFactors.set(state.assetClass, factor);
    }
    const shock = MARKET_FACTOR_WEIGHT * factor + IDIOSYNCRATIC_WEIGHT * random.normal();
    moveBps += state.sigmaBps * shock;

    // --- Mean reversion toward the anchor ----------------------------------
    const rawGapBps = Number(((anchor - state.price) * 10_000n) / anchor);
    const gapBps = Math.max(-MAX_REVERSION_GAP_BPS, Math.min(MAX_REVERSION_GAP_BPS, rawGapBps));
    moveBps += (gapBps * ENGINE.meanReversionBps) / 10_000;

    // --- Order-flow impact -------------------------------------------------
    if (state.flowSinceTick !== ZERO) {
      // flowSinceTick is a 1e8-scaled signed notional; the reference volume is in
      // whole currency units, so scale the flow down before dividing.
      const flowUnits = Number(state.flowSinceTick / 100n) / 1_000_000;
      moveBps += (ENGINE.impactBps * flowUnits) / ENGINE.impactReferenceVolume;
      // Consumed: impact is applied once, on the tick that follows the trade.
      state.flowSinceTick = ZERO;
    }

    // --- Event pressure, released gradually --------------------------------
    if (state.eventPressureBps !== 0) {
      const released = state.eventPressureBps * EVENT_RELEASE;
      moveBps += released;
      const remaining = state.eventPressureBps - released;
      state.eventPressureBps = Math.abs(remaining) < EVENT_PRESSURE_EPSILON ? 0 : remaining;
    }

    if (!Number.isFinite(moveBps)) return false;

    // --- Circuit breaker, then price bands ---------------------------------
    const limit = ENGINE.maxTickMoveBps;
    const clampedMove = Math.max(-limit, Math.min(limit, moveBps));

    const delta = mulRatio(state.price, BigInt(Math.round(clampedMove * 100)), MOVE_SCALE);
    let next = state.price + delta;

    const floor = maxFixed(bps(anchor, ENGINE.priceFloorBps), MIN_PRICE);
    const ceiling = maxFixed(bps(anchor, ENGINE.priceCeilingBps), floor);
    if (next < floor) next = floor;
    else if (next > ceiling) next = ceiling;

    if (next === state.price) return false;

    state.price = next;
    if (state.high24h === ZERO || next > state.high24h) state.high24h = next;
    if (state.low24h === ZERO || next < state.low24h) state.low24h = next;
    state.recent.push(next);
    while (state.recent.length > ENGINE.sparklineLength) state.recent.shift();
    state.dirty = true;
    return true;
  }

  /**
   * Stops and trailing stops must fire on simulated moves too. A player who set a
   * stop and never traded again would otherwise only be protected on ticks where
   * somebody else happened to hit the book.
   */
  private fireTriggers(ticker: string): void {
    const price = this.engine.price(ticker);
    if (price <= ZERO) return;
    try {
      void Promise.resolve(this.engine.matching?.checkTriggers(ticker, price)).catch((error: unknown) => {
        this.ctx.log.error({ err: error, ticker }, 'trigger check failed');
      });
    } catch (error) {
      this.ctx.log.error({ err: error, ticker }, 'trigger check failed');
    }
  }

  // -------------------------------------------------------------------------
  // Daily roll & persistence
  // -------------------------------------------------------------------------

  /** At UTC midnight yesterday's close becomes the reference for the 24h stats. */
  private rollDay(at: number): void {
    const day = Math.floor(at / MS_PER_DAY);
    if (day === this.utcDay) return;
    this.utcDay = day;
    for (const state of this.engine.all()) {
      state.previousClose = state.price;
      state.high24h = state.price;
      state.low24h = state.price;
      state.volume24h = ZERO;
      state.dirty = true;
    }
    this.ctx.log.info({ day }, 'rolled 24h market statistics');
  }

  private async persist(force = false): Promise<void> {
    // A slow database must not stack overlapping flushes on the same rows.
    if (this.persisting) return;
    this.persisting = true;
    try {
      await this.engine.persistPrices(force);
    } catch (error) {
      this.ctx.log.error({ err: error }, 'failed to persist prices');
    } finally {
      this.persisting = false;
    }
  }
}

function maxFixed(a: Fixed, b: Fixed): Fixed {
  return a > b ? a : b;
}
