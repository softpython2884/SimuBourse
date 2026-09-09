import { and, asc, eq, inArray, isNotNull, lt, lte, or } from 'drizzle-orm';
import {
  ENGINE,
  FEES,
  TRADING,
  ONE,
  ZERO,
  div,
  max,
  min,
  mul,
  mulRatio,
  notional,
  parseDecimal,
  percentOf,
  toDecimalString,
  units,
  type Fixed,
} from '@alvora/shared';
import { orders, trades, type Transaction } from '@alvora/db';
import * as accounts from '../services/accounts.js';
import type { Owner } from '../services/accounts.js';
import type { AssetState, EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

/**
 * Continuous double-auction matcher.
 *
 * Every fill it produces both moves money and moves shares, so the whole module
 * is written around three rules:
 *
 *  1. A trade prints at the **resting** order's price. The taker crossed the
 *     spread; the maker's limit is a promise the venue must keep, and pricing at
 *     the taker's limit instead would quietly hand the aggressor free edge.
 *  2. Settlement is one `db.transaction`. The in-memory book is mutated only
 *     after that commit returns, so a rolled-back fill can never leave the book
 *     believing liquidity was consumed.
 *  3. Work for one ticker is serialized through a promise chain. Two concurrent
 *     `submit()` calls that both read `asks[0]` would otherwise each try to take
 *     the same resting order.
 */

type OrderRow = typeof orders.$inferSelect;
type Side = 'buy' | 'sell';

/** Minimum fee, as fixed-point. `FEES.minimumFee` is a plain number of currency units. */
const MIN_FEE = parseDecimal(FEES.minimumFee);

/** Market-order slippage budget as a fraction of the reference price (500 bps → 0.05). */
const SLIPPAGE_FRACTION = mulRatio(ONE, BigInt(TRADING.marketOrderSlippageBps), 10_000n);

/** Notional at which the synthetic maker charges its full slippage budget. */
const IMPACT_REFERENCE = units(ENGINE.impactReferenceVolume);

/** Sentinel for "no quantity limit from the slippage cap". */
const UNLIMITED: Fixed = 10n ** 30n;

/** Bound on fills per cycle, so a pathological book cannot hold the chain forever. */
const MAX_FILLS_PER_CYCLE = 200;

const ACTIVE_STATUSES = ['open', 'partial'] as const;
const TRIGGER_TYPES = ['stop', 'stop_limit', 'trailing_stop'] as const;

/** Does a resting price satisfy a taker's limit? */
function crosses(limitPrice: Fixed, restingPrice: Fixed, isBuy: boolean): boolean {
  return isBuy ? restingPrice <= limitPrice : restingPrice >= limitPrice;
}

/** Worst average price a market order may end up with, relative to the pre-trade price. */
function slippageCap(reference: Fixed, isBuy: boolean): Fixed | null {
  if (reference <= ZERO) return null;
  const band = mul(reference, SLIPPAGE_FRACTION);
  return isBuy ? reference + band : max(reference - band, ZERO);
}

/**
 * How much more can be taken at `price` while the *average* fill price stays
 * within `cap`.
 *
 * The cap is on the average, not on each print: a taker that already filled well
 * inside the band has earned the right to reach a little further for the rest.
 * When `price` is itself within the cap the answer is unbounded, because the
 * running average is within the cap by induction.
 */
function capacityWithinCap(
  filledValue: Fixed,
  filledQuantity: Fixed,
  price: Fixed,
  cap: Fixed,
  isBuy: boolean,
): Fixed {
  if (isBuy ? price <= cap : price >= cap) return UNLIMITED;
  const budget = isBuy ? mul(filledQuantity, cap) - filledValue : filledValue - mul(filledQuantity, cap);
  if (budget <= ZERO) return ZERO;
  const gap = isBuy ? price - cap : cap - price;
  if (gap <= ZERO) return UNLIMITED;
  return div(budget, gap);
}

/**
 * Price quoted by the synthetic market maker.
 *
 * A brand-new listing has no resting liquidity; without this fallback its first
 * order would sit forever and the market would look broken. Slippage grows with
 * the order's notional relative to `ENGINE.impactReferenceVolume` and is clamped
 * at the market-order budget, so size costs the taker something without ever
 * breaching the protection it was promised. The lasting cost of size is applied
 * separately by `engine.recordFlow`, which moves the price on the next tick.
 */
function syntheticPrice(base: Fixed, quantity: Fixed, isBuy: boolean): Fixed {
  const value = notional(quantity, base);
  const ratio = IMPACT_REFERENCE > ZERO ? div(value, IMPACT_REFERENCE) : ONE;
  const slip = mul(SLIPPAGE_FRACTION, min(ratio, ONE));
  const move = mul(base, slip);
  return isBuy ? base + move : max(base - move, ONE / 100n);
}

/** Fee on one leg: bps of the notional, floored at the minimum, capped at the trade itself. */
function tradeFee(value: Fixed, basisPoints: number): Fixed {
  if (value <= ZERO) return ZERO;
  // Capping at the notional keeps a dust fill from costing more than it is
  // worth, which would make the fill unsettleable and jam the book behind it.
  return min(max(bpsFee(value, basisPoints), MIN_FEE), value);
}

function bpsFee(value: Fixed, basisPoints: number): Fixed {
  return mulRatio(value, BigInt(basisPoints), 10_000n, 'half-up');
}

/** Stable lock order across accounts, so two opposing settlements cannot deadlock. */
function ownerKey(owner: Owner): string {
  return `${owner.kind}:${String(owner.id).padStart(12, '0')}`;
}

interface SettleParams {
  ticker: string;
  price: Fixed;
  quantity: Fixed;
  takerOrderId: number;
  /** Null when the counterparty is the synthetic market maker. */
  makerOrderId: number | null;
  takerSide: Side;
}

interface FillLeg {
  orderId: number;
  userId: number;
  side: Side;
  fee: Fixed;
  remaining: Fixed;
  ownerKind: string;
  ownerId: number;
}

interface FillOutcome {
  tradeId: number;
  ticker: string;
  price: Fixed;
  quantity: Fixed;
  value: Fixed;
  takerSide: Side;
  takerRemaining: Fixed;
  makerRemaining: Fixed;
  buyer: FillLeg | null;
  seller: FillLeg | null;
}

export class MatchingEngine implements EngineModule {
  readonly name = 'matching';

  /** Per-ticker serialization: the tail of the in-flight work for that book. */
  private readonly chains = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;
  private stopped = false;

  constructor(
    private readonly ctx: EngineContext,
    private readonly engine: Engine,
  ) {}

  start(): void {
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.sweep();
    }, ENGINE.matchIntervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run a full match cycle for a freshly committed order and wait for it to
   * settle, so `POST /orders` can answer with the fills already applied.
   */
  async submit(orderId: number): Promise<void> {
    const row = await this.loadOrder(orderId);
    if (!row) return;
    await this.runExclusive(row.ticker, () => this.cycle(orderId));
  }

  /** Cross whatever is currently crossable on a ticker. */
  async matchTicker(ticker: string): Promise<void> {
    await this.runExclusive(ticker, () => this.crossBook(ticker.toUpperCase()));
  }

  /**
   * Activate stop, stop-limit and trailing-stop orders whose trigger the last
   * price crossed, and let trailing stops ratchet their anchor.
   */
  async checkTriggers(ticker: string, price: Fixed): Promise<void> {
    await this.runExclusive(ticker, () => this.runTriggers(ticker.toUpperCase(), price));
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  private runExclusive(ticker: string, task: () => Promise<void>): Promise<void> {
    const key = ticker.toUpperCase();
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(task)
      .catch((error: unknown) => {
        // A failed cycle has already rolled back; log and keep the chain alive
        // so one bad order does not freeze the whole book.
        this.ctx.log.error({ err: error, ticker: key }, 'matching cycle failed');
      });
    this.chains.set(key, next);
    void next.then(() => {
      if (this.chains.get(key) === next) this.chains.delete(key);
    });
    return next;
  }

  // -------------------------------------------------------------------------
  // Periodic sweep
  // -------------------------------------------------------------------------

  private async sweep(): Promise<void> {
    if (this.sweeping || this.stopped) return;
    this.sweeping = true;
    try {
      await this.expireOrders();
      await this.sweepTriggers();
      await this.sweepBooks();
    } catch (error) {
      this.ctx.log.error({ err: error }, 'matching sweep failed');
    } finally {
      this.sweeping = false;
    }
  }

  /** Expire `day` orders at UTC midnight and anything past its explicit `expiresAt`. */
  private async expireOrders(): Promise<void> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const rows = await this.ctx.db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          inArray(orders.status, [...ACTIVE_STATUSES]),
          or(
            and(isNotNull(orders.expiresAt), lte(orders.expiresAt, now)),
            and(eq(orders.timeInForce, 'day'), lt(orders.createdAt, startOfDay)),
          ),
        ),
      )
      .limit(500);

    for (const row of rows) {
      await this.closeOrder(row.id, 'expired', 'Ordre expiré.');
    }
  }

  private async sweepTriggers(): Promise<void> {
    const rows = await this.ctx.db
      .select({ ticker: orders.ticker })
      .from(orders)
      .where(and(inArray(orders.status, [...ACTIVE_STATUSES]), inArray(orders.type, [...TRIGGER_TYPES])))
      .groupBy(orders.ticker);

    for (const row of rows) {
      if (this.stopped) return;
      await this.checkTriggers(row.ticker, this.engine.price(row.ticker));
    }
  }

  private async sweepBooks(): Promise<void> {
    for (const state of this.engine.all()) {
      if (this.stopped) return;
      if (!state.isTradable) continue;
      const books = this.engine.books;
      // Bookless assets never cross internally, but their resting limit orders
      // still have to be filled once the simulated price reaches them.
      const due = state.hasOrderBook ? books.isCrossed(state.ticker) : books.size(state.ticker) > 0;
      if (due) await this.matchTicker(state.ticker);
    }
  }

  // -------------------------------------------------------------------------
  // Cycles (already serialized — these must never call the public wrappers)
  // -------------------------------------------------------------------------

  private async cycle(orderId: number): Promise<void> {
    const row = await this.loadOrder(orderId);
    if (!row || !isActive(row)) return;

    const state = this.engine.get(row.ticker);
    if (!state) return;
    if (!state.isTradable) {
      await this.closeOrder(row.id, 'cancelled', 'Cet actif n’est pas négociable.');
      return;
    }
    // A stop that has not fired yet is inert: `runTriggers` rewrites its type
    // when the price crosses, and only then does it reach the matcher.
    if (isTriggerType(row.type)) return;

    await this.executeTaker(row, state);
    // Resting the remainder may have left the book crossed against an older
    // order that was skipped for self-trade prevention.
    await this.crossBook(row.ticker);
  }

  /** Walk the opposite side of the book on behalf of an aggressing order. */
  private async executeTaker(row: OrderRow, state: AssetState): Promise<void> {
    const isBuy = row.side === 'buy';
    const isMarket = row.type === 'market';
    let remaining = row.quantity - row.filledQuantity;
    if (remaining <= ZERO) return;

    // Measured once, before this order touches the market: re-reading the price
    // between fills would let a large order keep re-basing its own protection.
    const cap = isMarket ? slippageCap(state.price, isBuy) : null;

    let filledQuantity = ZERO;
    let filledValue = ZERO;

    if (state.hasOrderBook) {
      if (row.timeInForce === 'fok' && !this.canFillFully(row, remaining, isMarket)) {
        await this.closeOrder(row.id, 'rejected', 'Ordre « tout ou rien » non exécutable intégralement.');
        return;
      }

      let failures = 0;
      for (let i = 0; i < MAX_FILLS_PER_CYCLE && remaining > ZERO; i += 1) {
        const maker = this.engine.books.bestMatchable(
          row.ticker,
          isBuy ? 'sell' : 'buy',
          row.ownerKind,
          row.ownerId,
        );
        if (!maker) break;
        if (!isMarket && (row.limitPrice === null || !crosses(row.limitPrice, maker.price, isBuy))) break;

        let quantity = min(remaining, maker.remaining);
        if (cap !== null) {
          const allowed = capacityWithinCap(filledValue, filledQuantity, maker.price, cap, isBuy);
          if (allowed <= ZERO) break;
          quantity = min(quantity, allowed);
        }
        if (quantity <= ZERO) break;

        const outcome = await this.settle({
          ticker: row.ticker,
          price: maker.price,
          quantity,
          takerOrderId: row.id,
          makerOrderId: maker.id,
          takerSide: row.side,
        });
        if (!outcome) {
          // The rows disagreed with the book (a concurrent cancel, or a failed
          // settlement): resynchronize and try the next resting order.
          await this.resync(maker.id);
          await this.resync(row.id);
          const refreshed = await this.loadOrder(row.id);
          if (!refreshed || !isActive(refreshed)) return;
          remaining = refreshed.quantity - refreshed.filledQuantity;
          // Repeated failures mean the taker itself cannot settle (no cash, no
          // shares); retrying the next maker would just replay the same error.
          failures += 1;
          if (failures >= 3) break;
          continue;
        }
        failures = 0;
        remaining = outcome.takerRemaining;
        filledQuantity += outcome.quantity;
        filledValue += outcome.value;
      }
    }

    // Synthetic backstop: market orders always execute, and bookless assets only
    // ever execute this way.
    if (remaining > ZERO && (isMarket || !state.hasOrderBook) && state.price > ZERO) {
      const price = syntheticPrice(state.price, remaining, isBuy);
      let quantity = remaining;
      if (!isMarket && (row.limitPrice === null || !crosses(row.limitPrice, price, isBuy))) {
        quantity = ZERO;
      }
      if (quantity > ZERO && cap !== null) {
        const allowed = capacityWithinCap(filledValue, filledQuantity, price, cap, isBuy);
        quantity = min(quantity, max(allowed, ZERO));
      }
      if (quantity > ZERO) {
        const outcome = await this.settle({
          ticker: row.ticker,
          price,
          quantity,
          takerOrderId: row.id,
          makerOrderId: null,
          takerSide: row.side,
        });
        if (outcome) {
          remaining = outcome.takerRemaining;
          filledQuantity += outcome.quantity;
        }
      }
    }

    await this.finishTaker(row, remaining, filledQuantity, isMarket, state);
  }

  /**
   * Would this order fill in full right now? Only asked for `fok`, which must
   * reject before touching a single balance rather than unwinding fills.
   */
  private canFillFully(row: OrderRow, remaining: Fixed, isMarket: boolean): boolean {
    // A market order is always fully fillable: the synthetic maker has no depth
    // limit, and the slippage cap only ever improves the price it quotes.
    if (isMarket) return true;
    const limit = row.limitPrice;
    if (limit === null) return false;

    const isBuy = row.side === 'buy';
    const opposite = isBuy ? this.engine.books.asks(row.ticker) : this.engine.books.bids(row.ticker);
    let available = ZERO;
    for (const entry of opposite) {
      if (!crosses(limit, entry.price, isBuy)) break;
      if (entry.ownerKind === row.ownerKind && entry.ownerId === row.ownerId) continue;
      available += entry.remaining;
      if (available >= remaining) return true;
    }
    return available >= remaining;
  }

  /** Decide what happens to the part of a taker order the book could not fill. */
  private async finishTaker(
    row: OrderRow,
    remaining: Fixed,
    filledQuantity: Fixed,
    isMarket: boolean,
    state: AssetState,
  ): Promise<void> {
    if (remaining <= ZERO) return;

    if (row.timeInForce === 'ioc' || row.timeInForce === 'fok') {
      await this.closeOrder(row.id, 'cancelled', 'Reliquat annulé : ordre à exécution immédiate.');
      return;
    }
    if (isMarket) {
      await this.closeOrder(
        row.id,
        'cancelled',
        filledQuantity > ZERO
          ? 'Slippage trop important, reliquat annulé.'
          : 'Aucune liquidité disponible pour cet ordre au marché.',
      );
      return;
    }

    const limit = row.limitPrice;
    if (limit === null) {
      await this.closeOrder(row.id, 'cancelled', 'Prix limite manquant.');
      return;
    }

    // Rest. Bookless assets keep the order in memory too, so it stays visible
    // and cancellable and can still fill against the synthetic maker later.
    this.engine.books.add({
      id: row.id,
      ticker: state.ticker,
      ownerKind: row.ownerKind,
      ownerId: row.ownerId,
      userId: row.userId,
      side: row.side,
      price: limit,
      remaining,
      createdAt: row.createdAt.getTime(),
      sequence: 0,
    });
    this.ctx.bus.emit('book', { ticker: state.ticker });
  }

  /** Cross resting orders against each other until the book is no longer crossed. */
  private async crossBook(ticker: string): Promise<void> {
    const state = this.engine.get(ticker);
    if (!state || !state.isTradable) return;

    if (!state.hasOrderBook) {
      await this.fillRestingSynthetically(ticker, state);
      return;
    }

    let failures = 0;
    for (let i = 0; i < MAX_FILLS_PER_CYCLE; i += 1) {
      const pair = this.engine.books.bestCross(ticker);
      if (!pair) return;
      const { bid, ask } = pair;

      // The later arrival crossed the spread, so it is the taker and the older
      // order's limit sets the print.
      const takerIsBid = bid.sequence > ask.sequence;
      const maker = takerIsBid ? ask : bid;
      const taker = takerIsBid ? bid : ask;

      const outcome = await this.settle({
        ticker,
        price: maker.price,
        quantity: min(bid.remaining, ask.remaining),
        takerOrderId: taker.id,
        makerOrderId: maker.id,
        takerSide: taker.side,
      });
      if (!outcome) {
        await this.resync(maker.id);
        await this.resync(taker.id);
        // Give up rather than spin: whatever blocks this pair will still block
        // it on the next attempt, and the sweep will come back in a second.
        failures += 1;
        if (failures >= 3) return;
        continue;
      }
      failures = 0;
    }
  }

  /**
   * Fill resting limit orders on a bookless asset against the synthetic maker
   * once the simulated price reaches their limit.
   */
  private async fillRestingSynthetically(ticker: string, state: AssetState): Promise<void> {
    if (state.price <= ZERO) return;
    const resting = [...this.engine.books.bids(ticker), ...this.engine.books.asks(ticker)];

    for (const entry of resting.slice(0, MAX_FILLS_PER_CYCLE)) {
      if (entry.remaining <= ZERO) continue;
      const isBuy = entry.side === 'buy';
      const price = syntheticPrice(state.price, entry.remaining, isBuy);
      if (!crosses(entry.price, price, isBuy)) continue;

      const outcome = await this.settle({
        ticker,
        price,
        quantity: entry.remaining,
        takerOrderId: entry.id,
        makerOrderId: null,
        takerSide: entry.side,
      });
      if (!outcome) await this.resync(entry.id);
    }
  }

  // -------------------------------------------------------------------------
  // Triggers
  // -------------------------------------------------------------------------

  private async runTriggers(ticker: string, price: Fixed): Promise<void> {
    if (price <= ZERO) return;

    const rows = await this.ctx.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.ticker, ticker),
          inArray(orders.status, [...ACTIVE_STATUSES]),
          inArray(orders.type, [...TRIGGER_TYPES]),
        ),
      )
      .orderBy(asc(orders.id));

    for (const row of rows) {
      const isBuy = row.side === 'buy';
      let stop = row.stopPrice;

      if (row.type === 'trailing_stop') {
        const trail = row.trailPercent;
        if (trail === null || trail <= ZERO) continue;
        const anchor = row.trailAnchor;
        // The anchor ratchets one way only: the best price seen since the order
        // was placed. A trailing stop that could walk backwards would follow the
        // price down and never protect anything.
        const nextAnchor = anchor === null ? price : isBuy ? min(anchor, price) : max(anchor, price);
        const distance = percentOf(nextAnchor, trail);
        const nextStop = isBuy ? nextAnchor + distance : max(nextAnchor - distance, ZERO);
        if (anchor === null || nextAnchor !== anchor || row.stopPrice !== nextStop) {
          await this.ctx.db
            .update(orders)
            .set({ trailAnchor: nextAnchor, stopPrice: nextStop, updatedAt: new Date() })
            .where(eq(orders.id, row.id));
        }
        stop = nextStop;
      }

      if (stop === null || stop <= ZERO) continue;
      if (isBuy ? price < stop : price > stop) continue;
      await this.activate(row);
    }
  }

  /**
   * Arm a triggered order by rewriting its type in place. Persisting the
   * activation is what keeps a restart from re-arming a stop that already fired
   * — and it is why `BookManager.load()` can trust `type = 'limit'`.
   */
  private async activate(row: OrderRow): Promise<void> {
    const nextType = row.limitPrice === null ? 'market' : 'limit';
    const updated = await this.ctx.db
      .update(orders)
      .set({ type: nextType, updatedAt: new Date() })
      .where(
        and(
          eq(orders.id, row.id),
          inArray(orders.status, [...ACTIVE_STATUSES]),
          inArray(orders.type, [...TRIGGER_TYPES]),
        ),
      )
      .returning({ id: orders.id });
    if (updated.length === 0) return;
    await this.cycle(row.id);
  }

  // -------------------------------------------------------------------------
  // Settlement
  // -------------------------------------------------------------------------

  /**
   * Apply one fill. Everything that moves value happens inside a single
   * transaction; the book, the price feed and the event bus are touched only
   * once that transaction has committed.
   *
   * Returns null when the fill could not be applied at all — the caller then
   * resynchronizes the book from the database rather than assuming depth was
   * consumed.
   */
  private async settle(params: SettleParams): Promise<FillOutcome | null> {
    if (params.price <= ZERO || params.quantity <= ZERO) return null;

    let outcome: FillOutcome | null = null;
    try {
      outcome = await this.ctx.db.transaction((tx) => this.settleInTransaction(tx, params));
    } catch (error) {
      this.ctx.log.error(
        { err: error, ticker: params.ticker, taker: params.takerOrderId, maker: params.makerOrderId },
        'trade settlement rolled back',
      );
      return null;
    }
    if (!outcome) return null;

    this.applyToBook(params.takerOrderId, outcome.takerRemaining, outcome.quantity);
    if (params.makerOrderId !== null) {
      this.applyToBook(params.makerOrderId, outcome.makerRemaining, outcome.quantity);
    }

    this.engine.recordTrade(outcome.ticker, outcome.price, outcome.quantity, outcome.value);
    // Signed by the aggressor: a taker buy is buying pressure on the next tick.
    this.engine.recordFlow(outcome.ticker, outcome.takerSide === 'buy' ? outcome.value : -outcome.value);

    this.ctx.bus.emit('trade', {
      id: outcome.tradeId,
      ticker: outcome.ticker,
      price: outcome.price.toString(),
      quantity: outcome.quantity.toString(),
      side: outcome.takerSide,
      at: Date.now(),
      buyerId: outcome.buyer?.ownerId ?? null,
      sellerId: outcome.seller?.ownerId ?? null,
      buyerKind: outcome.buyer?.ownerKind ?? null,
      sellerKind: outcome.seller?.ownerKind ?? null,
    });

    const dirty = new Set<number>();
    for (const leg of [outcome.buyer, outcome.seller]) {
      if (!leg) continue;
      this.ctx.bus.emit('orderFill', {
        userId: leg.userId,
        orderId: leg.orderId,
        ticker: outcome.ticker,
        side: leg.side,
        quantity: outcome.quantity.toString(),
        price: outcome.price.toString(),
        fee: leg.fee.toString(),
        isFinal: leg.remaining <= ZERO,
      });
      dirty.add(leg.userId);
    }
    this.ctx.bus.emit('book', { ticker: outcome.ticker });
    for (const userId of dirty) this.ctx.bus.emit('portfolioDirty', { userId });

    return outcome;
  }

  private async settleInTransaction(tx: Transaction, params: SettleParams): Promise<FillOutcome | null> {
    const { ticker, price, takerSide } = params;

    // Lock the order rows by ascending id, so two settlements that share a pair
    // of orders always take them in the same order.
    const ids = (params.makerOrderId === null ? [params.takerOrderId] : [params.takerOrderId, params.makerOrderId]).sort(
      (a, b) => a - b,
    );
    const locked = new Map<number, OrderRow>();
    for (const id of ids) {
      const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!row) return null;
      locked.set(id, row);
    }

    const takerRow = locked.get(params.takerOrderId);
    if (!takerRow || !isActive(takerRow)) return null;
    const makerRow = params.makerOrderId === null ? null : (locked.get(params.makerOrderId) ?? null);

    if (params.makerOrderId !== null) {
      if (!makerRow || !isActive(makerRow)) return null;
      if (makerRow.side === takerRow.side) return null;
      if (makerRow.limitPrice === null || makerRow.limitPrice !== price) return null;
      // Second line of defence behind BookManager.bestMatchable: the durable
      // rows, not the cache, decide whether this would be a wash trade.
      if (makerRow.ownerKind === takerRow.ownerKind && makerRow.ownerId === takerRow.ownerId) return null;
    }

    const takerOpen = takerRow.quantity - takerRow.filledQuantity;
    const makerOpen = makerRow ? makerRow.quantity - makerRow.filledQuantity : params.quantity;
    const quantity = min(params.quantity, min(takerOpen, makerOpen));
    if (quantity <= ZERO) return null;

    const value = notional(quantity, price);
    const takerFee = tradeFee(value, FEES.spotTakerBps);
    const makerFee = makerRow ? tradeFee(value, FEES.spotMakerBps) : ZERO;

    const buyRow = takerSide === 'buy' ? takerRow : makerRow;
    const sellRow = takerSide === 'buy' ? makerRow : takerRow;
    const buyFee = takerSide === 'buy' ? takerFee : makerFee;
    const sellFee = takerSide === 'buy' ? makerFee : takerFee;

    const buyer: Owner | null = buyRow ? { kind: buyRow.ownerKind, id: buyRow.ownerId } : null;
    const seller: Owner | null = sellRow ? { kind: sellRow.ownerKind, id: sellRow.ownerId } : null;

    // Take every cash lock up front, in a canonical order, before any balance is
    // read for validation. Holdings are then locked underneath a lock we already
    // hold, so a pair of opposing trades cannot deadlock.
    for (const owner of [buyer, seller].filter((o): o is Owner => o !== null).sort((a, b) => (ownerKey(a) < ownerKey(b) ? -1 : 1))) {
      await accounts.lockBalances(tx, owner);
    }

    const [tradeRow] = await tx
      .insert(trades)
      .values({
        ticker,
        price,
        quantity,
        value,
        buyOrderId: buyRow?.id ?? null,
        sellOrderId: sellRow?.id ?? null,
        buyerKind: buyer?.kind ?? null,
        buyerId: buyer?.id ?? null,
        sellerKind: seller?.kind ?? null,
        sellerId: seller?.id ?? null,
        buyerFee: buyFee,
        sellerFee: sellFee,
        isSynthetic: makerRow === null,
        takerSide,
      })
      .returning({ id: trades.id });
    if (!tradeRow) return null;

    const quantityLabel = toDecimalString(quantity);
    const tradeRef = { refType: 'trade', refId: tradeRow.id } as const;

    let buyReservedAfter = ZERO;
    if (buyer && buyRow) {
      buyReservedAfter = buyRow.reservedCash;
      const cashContext = {
        kind: 'trade',
        description: `Achat de ${quantityLabel} ${ticker}`,
        ticker,
        quantity,
        price,
        counterparty: seller,
        ...tradeRef,
      };
      // Spend the reservation first: it is the cash this order already set aside.
      const spentLocked = min(value, buyReservedAfter);
      await accounts.debit(tx, buyer, spentLocked, cashContext, true);
      await accounts.debit(tx, buyer, value - spentLocked, cashContext, false);
      buyReservedAfter -= spentLocked;

      if (buyFee > ZERO) {
        // Fees are debited, never credited to a counterparty: they leave the
        // simulated economy, which is the only sink balancing the daily bonus.
        const feeContext = {
          kind: 'fee',
          description: `Frais d’exécution ${ticker}`,
          ticker,
          quantity,
          price,
          ...tradeRef,
        };
        const feeLocked = min(buyFee, buyReservedAfter);
        await accounts.debit(tx, buyer, feeLocked, feeContext, true);
        await accounts.debit(tx, buyer, buyFee - feeLocked, feeContext, false);
        buyReservedAfter -= feeLocked;
      }

      await accounts.addToPosition(tx, buyer, ticker, quantity, price);
    }

    let sellReservedAfter = ZERO;
    if (seller && sellRow) {
      const reservedQuantity = sellRow.reservedQuantity;
      const fromLocked = min(quantity, reservedQuantity);
      // Split so the reserved shares of a resting sell are consumed from the
      // lock, while an unreserved market sell draws on the free balance.
      await accounts.removeFromPosition(tx, seller, ticker, fromLocked, price, true);
      await accounts.removeFromPosition(tx, seller, ticker, quantity - fromLocked, price, false);
      sellReservedAfter = reservedQuantity - fromLocked;

      const cashContext = {
        kind: 'trade',
        description: `Vente de ${quantityLabel} ${ticker}`,
        ticker,
        quantity,
        price,
        counterparty: buyer,
        ...tradeRef,
      };
      await accounts.credit(tx, seller, value, cashContext);
      if (sellFee > ZERO) {
        await accounts.debit(
          tx,
          seller,
          sellFee,
          { kind: 'fee', description: `Frais d’exécution ${ticker}`, ticker, quantity, price, ...tradeRef },
          false,
        );
      }
    }

    const buyRemaining = buyRow && buyer
      ? await this.applyFill(tx, buyRow, buyer, quantity, price, buyFee, buyReservedAfter)
      : ZERO;
    const sellRemaining = sellRow && seller
      ? await this.applyFill(tx, sellRow, seller, quantity, price, sellFee, sellReservedAfter)
      : ZERO;

    const takerRemaining = takerSide === 'buy' ? buyRemaining : sellRemaining;
    const makerRemaining = makerRow === null ? ZERO : takerSide === 'buy' ? sellRemaining : buyRemaining;

    return {
      tradeId: tradeRow.id,
      ticker,
      price,
      quantity,
      value,
      takerSide,
      takerRemaining,
      makerRemaining,
      buyer: buyRow
        ? {
            orderId: buyRow.id,
            userId: buyRow.userId,
            side: 'buy',
            fee: buyFee,
            remaining: buyRemaining,
            ownerKind: buyRow.ownerKind,
            ownerId: buyRow.ownerId,
          }
        : null,
      seller: sellRow
        ? {
            orderId: sellRow.id,
            userId: sellRow.userId,
            side: 'sell',
            fee: sellFee,
            remaining: sellRemaining,
            ownerKind: sellRow.ownerKind,
            ownerId: sellRow.ownerId,
          }
        : null,
    };
  }

  /**
   * Write the fill onto one order row and true up its reservation.
   *
   * A resting buy reserved cash at its own limit; filling at a better price
   * leaves that difference locked, so it is released here. Anything else would
   * quietly freeze part of the buyer's balance for as long as the order lives.
   */
  private async applyFill(
    tx: Transaction,
    row: OrderRow,
    owner: Owner,
    quantity: Fixed,
    price: Fixed,
    fee: Fixed,
    reservedAfterFill: Fixed,
  ): Promise<Fixed> {
    const filled = row.filledQuantity + quantity;
    const remaining = row.quantity - filled;
    // Weighted average from exact integers, so it cannot drift over many fills.
    const average = filled > ZERO ? div(mul(row.averagePrice, row.filledQuantity) + mul(price, quantity), filled) : ZERO;

    let reservedCash = row.reservedCash;
    let reservedQuantity = row.reservedQuantity;

    if (row.side === 'buy') {
      const needed =
        remaining <= ZERO
          ? ZERO
          : row.limitPrice !== null
            ? notional(remaining, row.limitPrice)
            : // A market buy has no limit to re-price against; keep whatever is
              // still reserved until the order finishes.
              reservedAfterFill;
      if (reservedAfterFill > needed) await accounts.releaseCash(tx, owner, reservedAfterFill - needed);
      reservedCash = min(reservedAfterFill, needed);
    } else {
      const needed = remaining <= ZERO ? ZERO : min(reservedAfterFill, remaining);
      if (reservedAfterFill > needed) {
        await accounts.releaseQuantity(tx, owner, row.ticker, reservedAfterFill - needed);
      }
      reservedQuantity = needed;
    }

    await tx
      .update(orders)
      .set({
        filledQuantity: filled,
        averagePrice: average,
        feePaid: row.feePaid + fee,
        status: remaining <= ZERO ? 'filled' : 'partial',
        reservedCash,
        reservedQuantity,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, row.id));

    return remaining;
  }

  // -------------------------------------------------------------------------
  // Order lifecycle helpers
  // -------------------------------------------------------------------------

  /**
   * Terminate an order and hand back everything it still holds. Releasing the
   * reservation is the whole point: a cancelled order that kept its lock would
   * strand the owner's cash or shares with nothing to show for it.
   */
  private async closeOrder(
    orderId: number,
    status: 'cancelled' | 'rejected' | 'expired',
    reason: string,
  ): Promise<void> {
    const closed = await this.ctx.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!row || !isActive(row)) return null;
      const owner: Owner = { kind: row.ownerKind, id: row.ownerId };

      if (row.reservedCash > ZERO) await accounts.releaseCash(tx, owner, row.reservedCash);
      if (row.reservedQuantity > ZERO) {
        await accounts.releaseQuantity(tx, owner, row.ticker, row.reservedQuantity);
      }
      await tx
        .update(orders)
        .set({ status, rejectReason: reason, reservedCash: ZERO, reservedQuantity: ZERO, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      return { ticker: row.ticker, userId: row.userId };
    });
    if (!closed) return;

    this.engine.books.remove(orderId);
    this.ctx.bus.emit('book', { ticker: closed.ticker });
    this.ctx.bus.emit('portfolioDirty', { userId: closed.userId });
  }

  /** Bring the cached book entry back in line with the durable row. */
  private async resync(orderId: number): Promise<void> {
    const row = await this.loadOrder(orderId);
    const entry = this.engine.books.get(orderId);
    if (!entry) return;
    if (!row || !isActive(row) || row.limitPrice === null) {
      this.engine.books.remove(orderId);
      return;
    }
    const remaining = row.quantity - row.filledQuantity;
    if (remaining <= ZERO) this.engine.books.remove(orderId);
    else if (remaining !== entry.remaining) this.engine.books.reduce(orderId, entry.remaining - remaining);
  }

  private applyToBook(orderId: number, remaining: Fixed, filled: Fixed): void {
    if (!this.engine.books.get(orderId)) return;
    if (remaining <= ZERO) this.engine.books.remove(orderId);
    else this.engine.books.reduce(orderId, filled);
  }

  private async loadOrder(orderId: number): Promise<OrderRow | null> {
    const [row] = await this.ctx.db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return row ?? null;
  }
}

function isActive(row: Pick<OrderRow, 'status'>): boolean {
  return row.status === 'open' || row.status === 'partial';
}

function isTriggerType(type: OrderRow['type']): boolean {
  return type === 'stop' || type === 'stop_limit' || type === 'trailing_stop';
}
