import { eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  ENGINE,
  VOLATILITY,
  ZERO,
  type AssetClass,
  type Fixed,
  type OrderBook,
  type PriceTick,
} from '@alvora/shared';
import { assets, type Database } from '@alvora/db';
import { EngineBus } from './bus.js';
import type { AssetState, EngineContext } from './types.js';
import { PriceSimulator } from './pricing.js';
import { BookManager } from './book.js';
import { MatchingEngine } from './matching.js';
import { CandleAggregator } from './candles.js';
import { EventGenerator } from './events.js';
import { ChainSimulator } from './chains.js';
import { MiningPool } from './mining.js';
import { Scheduler } from './scheduler.js';

export interface EngineOptions {
  db: Database;
  enabled: boolean;
}

/**
 * The single authoritative simulation.
 *
 * Everything that moves a price, mines a block or settles a market happens in
 * this one process. The legacy app generated prices in the browser, so every
 * player saw a different market and nothing was verifiable; here the server owns
 * the state and clients only observe it.
 */
export class Engine {
  readonly bus = new EngineBus();
  readonly db: Database;

  private readonly enabled: boolean;
  private readonly states = new Map<string, AssetState>();
  private log: FastifyBaseLogger = console as unknown as FastifyBaseLogger;

  private pricing!: PriceSimulator;
  private candlesModule!: CandleAggregator;
  private eventsModule!: EventGenerator;
  private chainsModule!: ChainSimulator;
  private miningModule!: MiningPool;
  private schedulerModule!: Scheduler;

  books!: BookManager;
  matching!: MatchingEngine;

  private startedAt = 0;
  private tickCount = 0;
  private running = false;

  constructor(options: EngineOptions) {
    this.db = options.db;
    this.enabled = options.enabled;
  }

  attachLogger(log: FastifyBaseLogger): void {
    this.log = log.child({ module: 'engine' });
  }

  private get context(): EngineContext {
    return { db: this.db, bus: this.bus, log: this.log };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return;
    await this.loadAssets();

    const ctx = this.context;
    this.books = new BookManager(ctx, this);
    this.matching = new MatchingEngine(ctx, this);
    this.pricing = new PriceSimulator(ctx, this);
    this.candlesModule = new CandleAggregator(ctx, this);
    this.eventsModule = new EventGenerator(ctx, this);
    this.chainsModule = new ChainSimulator(ctx, this);
    this.miningModule = new MiningPool(ctx, this);
    this.schedulerModule = new Scheduler(ctx, this);

    // The book is always loaded: resting orders must be visible and cancellable
    // even when the simulation loop itself is disabled for maintenance.
    await this.books.start();
    await this.matching.start();

    if (this.enabled) {
      await this.pricing.start();
      await this.candlesModule.start();
      await this.eventsModule.start();
      await this.chainsModule.start();
      await this.miningModule.start();
      await this.schedulerModule.start();
    } else {
      this.log.warn('engine simulation disabled (ENGINE_ENABLED=false)');
    }

    this.startedAt = Date.now();
    this.running = true;
    this.log.info({ assets: this.states.size, enabled: this.enabled }, 'engine started');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    // Reverse order, so nothing schedules new work while an earlier module flushes.
    for (const module of [
      this.schedulerModule,
      this.miningModule,
      this.chainsModule,
      this.eventsModule,
      this.candlesModule,
      this.pricing,
      this.matching,
      this.books,
    ]) {
      try {
        await module?.stop();
      } catch (error) {
        this.log.error({ err: error, module: module?.name }, 'engine module failed to stop');
      }
    }
    await this.persistPrices(true);
    this.bus.removeAll();
    this.log.info('engine stopped');
  }

  // -------------------------------------------------------------------------
  // Asset state
  // -------------------------------------------------------------------------

  private async loadAssets(): Promise<void> {
    const rows = await this.db.select().from(assets);
    this.states.clear();
    for (const row of rows) this.states.set(row.ticker, toState(row));
  }

  /** Called when a company lists or an admin adds an instrument mid-flight. */
  async registerAsset(ticker: string): Promise<AssetState | null> {
    const [row] = await this.db.select().from(assets).where(eq(assets.ticker, ticker)).limit(1);
    if (!row) return null;
    const state = toState(row);
    this.states.set(row.ticker, state);
    return state;
  }

  unregisterAsset(ticker: string): void {
    this.states.delete(ticker);
    this.books?.drop(ticker);
  }

  get(ticker: string): AssetState | undefined {
    return this.states.get(ticker.toUpperCase());
  }

  require(ticker: string): AssetState {
    const state = this.get(ticker);
    if (!state) throw new Error(`Unknown asset: ${ticker}`);
    return state;
  }

  all(): AssetState[] {
    return [...this.states.values()];
  }

  /** Last traded price, or zero for an unknown ticker (never NaN). */
  price(ticker: string): Fixed {
    return this.states.get(ticker.toUpperCase())?.price ?? ZERO;
  }

  /** Prices for many tickers at once, for portfolio valuation. */
  prices(tickers: Iterable<string>): Map<string, Fixed> {
    const out = new Map<string, Fixed>();
    for (const ticker of tickers) out.set(ticker, this.price(ticker));
    return out;
  }

  snapshot(): PriceTick[] {
    return this.all().map((state) => ({
      ticker: state.ticker,
      price: state.price.toString(),
      changePct24h: pctChangeFixed(state.previousClose, state.price).toString(),
      volume24h: state.volume24h.toString(),
      at: Date.now(),
    }));
  }

  book(ticker: string, depth = 20): OrderBook {
    return this.books.snapshot(ticker.toUpperCase(), depth);
  }

  // -------------------------------------------------------------------------
  // Feedback from trading into the simulation
  // -------------------------------------------------------------------------

  /**
   * Record executed volume so the next tick reflects genuine order flow.
   * `signedNotional` is positive for buying pressure, negative for selling.
   */
  recordFlow(ticker: string, signedNotional: Fixed): void {
    const state = this.get(ticker);
    if (!state) return;
    state.flowSinceTick += signedNotional;
    state.dirty = true;
  }

  /** Record a fill: updates last price, 24h stats and the candle aggregate. */
  recordTrade(ticker: string, price: Fixed, quantity: Fixed, value: Fixed): void {
    const state = this.get(ticker);
    if (!state) return;
    state.price = price;
    state.volume24h += value;
    if (price > state.high24h || state.high24h === ZERO) state.high24h = price;
    if (price < state.low24h || state.low24h === ZERO) state.low24h = price;
    state.recent.push(price);
    if (state.recent.length > ENGINE.sparklineLength) state.recent.shift();
    state.dirty = true;
    this.candlesModule?.record(ticker, price, quantity);
  }

  /** Apply an external price shock, in basis points (news, admin, company action). */
  applyPressure(ticker: string, impactBps: number): void {
    const state = this.get(ticker);
    if (!state) return;
    state.eventPressureBps += impactBps;
    state.dirty = true;
  }

  /** Overwrite a price outright — used by IPO pricing and admin corrections. */
  setPrice(ticker: string, price: Fixed, alsoAnchor = false): void {
    const state = this.get(ticker);
    if (!state || price <= ZERO) return;
    state.price = price;
    if (alsoAnchor) state.anchorPrice = price;
    state.dirty = true;
  }

  markTick(): void {
    this.tickCount += 1;
  }

  /** Flush dirty prices to the database in one batched statement. */
  async persistPrices(force = false): Promise<void> {
    const dirty = this.all().filter((state) => force || state.dirty);
    if (dirty.length === 0) return;

    const values = dirty
      .map(
        (s) =>
          `('${s.ticker}'::varchar,${s.price.toString()}::numeric,${s.high24h.toString()}::numeric,` +
          `${s.low24h.toString()}::numeric,${s.volume24h.toString()}::numeric,` +
          `${s.circulatingSupply === null ? 'NULL' : `${((s.circulatingSupply * s.price) / 100000000n).toString()}`}::numeric)`,
      )
      .join(',');

    await this.db.execute(
      sql.raw(
        `UPDATE assets AS a SET price = v.price, high_24h = v.high, low_24h = v.low,
           volume_24h = v.volume, market_cap = v.cap, updated_at = now()
         FROM (VALUES ${values}) AS v(ticker, price, high, low, volume, cap)
         WHERE a.ticker = v.ticker`,
      ),
    );
    for (const state of dirty) state.dirty = false;
  }

  stats(): { uptimeSeconds: number; tickCount: number; assets: number; running: boolean } {
    return {
      uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      tickCount: this.tickCount,
      assets: this.states.size,
      running: this.running,
    };
  }
}

function toState(row: typeof assets.$inferSelect): AssetState {
  const defaults = VOLATILITY[row.assetClass as AssetClass] ?? VOLATILITY.Stock;
  return {
    ticker: row.ticker,
    name: row.name,
    assetClass: row.assetClass,
    price: row.price,
    anchorPrice: row.anchorPrice,
    previousClose: row.previousClose,
    high24h: row.high24h,
    low24h: row.low24h,
    volume24h: row.volume24h,
    circulatingSupply: row.circulatingSupply,
    sigmaBps: row.sigmaBps ?? defaults.sigmaBps,
    driftBps: row.driftBps ?? defaults.driftBps,
    isTradable: row.isTradable,
    hasOrderBook: row.hasOrderBook,
    companyId: row.companyId,
    chain: row.chain,
    flowSinceTick: ZERO,
    eventPressureBps: 0,
    recent: [row.price],
    dirty: false,
  };
}

function pctChangeFixed(from: Fixed, to: Fixed): Fixed {
  if (from === ZERO) return ZERO;
  return ((to - from) * 100_000_000n * 100n) / from;
}
