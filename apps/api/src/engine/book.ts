import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { ZERO, type BookLevel, type Fixed, type OrderBook } from '@alvora/shared';
import { orders } from '@alvora/db';
import type { BookOrder, EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

/**
 * In-memory limit order book, one per ticker.
 *
 * The database is the durable record of every order; this is the hot index the
 * matcher reads on every fill. Two invariants make the matching engine correct:
 *
 *  - each side is kept in strict price-time priority (bids price-descending,
 *    asks price-ascending, ties by `sequence`), so `bids[0]` / `asks[0]` are
 *    always the orders that must trade next;
 *  - `index` maps an order id to the exact object stored in one of the arrays,
 *    so a cancel is a lookup plus a binary search rather than a scan of every
 *    resting order on the venue.
 */

type Side = 'buy' | 'sell';

interface SideBook {
  bids: BookOrder[];
  asks: BookOrder[];
}

/**
 * Ordering used by both insertion and lookup. Returns < 0 when `a` has priority
 * over `b`. Sequence is unique and monotonic, so the comparison is a total order
 * and a binary search can locate any resting order exactly.
 */
function comparePriority(a: BookOrder, b: BookOrder, side: Side): number {
  if (a.price !== b.price) {
    if (side === 'buy') return a.price > b.price ? -1 : 1;
    return a.price < b.price ? -1 : 1;
  }
  return a.sequence - b.sequence;
}

/** How deep the aggregation walks before giving up, so one huge book cannot stall a snapshot. */
const MAX_SNAPSHOT_SCAN = 5_000;

export class BookManager implements EngineModule {
  readonly name = 'book';

  private readonly books = new Map<string, SideBook>();
  private readonly index = new Map<number, BookOrder>();
  /** Monotonic arrival counter; ties at the same price are broken by it. */
  private sequenceCounter = 0;

  constructor(
    private readonly ctx: EngineContext,
    private readonly engine: Engine,
  ) {}

  async start(): Promise<void> {
    await this.load();
  }

  stop(): void {
    this.books.clear();
    this.index.clear();
  }

  // -------------------------------------------------------------------------
  // Rebuild
  // -------------------------------------------------------------------------

  /**
   * Rebuild every book from the durable orders. Without this a process restart
   * would silently drop all resting liquidity while the rows still reserved the
   * owners' cash and shares.
   *
   * Only `type = 'limit'` rows are restored: an untriggered stop-limit also
   * carries a `limitPrice`, and resting it would execute a stop that never
   * fired. The matcher rewrites a triggered stop's type to `limit`/`market`,
   * which is precisely what makes that filter safe across a restart.
   */
  async load(): Promise<void> {
    this.books.clear();
    this.index.clear();
    this.sequenceCounter = 0;

    const rows = await this.ctx.db
      .select()
      .from(orders)
      .where(
        and(
          inArray(orders.status, ['open', 'partial']),
          eq(orders.type, 'limit'),
          isNotNull(orders.limitPrice),
        ),
      )
      // Restored in arrival order so the generated sequences reproduce the
      // original time priority.
      .orderBy(asc(orders.createdAt), asc(orders.id));

    let restored = 0;
    for (const row of rows) {
      const price = row.limitPrice;
      if (price === null || price <= ZERO) continue;
      const remaining = row.quantity - row.filledQuantity;
      if (remaining <= ZERO) continue;
      this.add({
        id: row.id,
        ticker: row.ticker,
        ownerKind: row.ownerKind,
        ownerId: row.ownerId,
        userId: row.userId,
        side: row.side,
        price,
        remaining,
        createdAt: row.createdAt.getTime(),
        sequence: 0,
      });
      restored += 1;
    }

    this.ctx.log.info({ orders: restored, tickers: this.books.size }, 'order books restored');
  }

  // -------------------------------------------------------------------------
  // Mutation
  // -------------------------------------------------------------------------

  /**
   * Insert (or re-insert) a resting order.
   *
   * Idempotent by order id: re-adding an order that is already resting moves it
   * rather than duplicating it, so a retried submission can never create two
   * book entries backed by one database row — which would let the same reserved
   * cash be spent twice.
   */
  add(order: BookOrder): BookOrder | null {
    if (order.remaining <= ZERO || order.price <= ZERO) return null;
    if (this.index.has(order.id)) this.remove(order.id);

    const sequence = order.sequence > 0 ? order.sequence : this.sequenceCounter + 1;
    if (sequence > this.sequenceCounter) this.sequenceCounter = sequence;

    const entry: BookOrder = { ...order, ticker: order.ticker.toUpperCase(), sequence };
    const book = this.ensure(entry.ticker);
    const list = entry.side === 'buy' ? book.bids : book.asks;
    list.splice(this.locate(list, entry, entry.side), 0, entry);
    this.index.set(entry.id, entry);
    return entry;
  }

  /** Take an order off the book. Returns the removed entry, or null if it was not resting. */
  remove(orderId: number): BookOrder | null {
    const entry = this.index.get(orderId);
    if (!entry) return null;
    this.index.delete(orderId);

    const book = this.books.get(entry.ticker);
    if (book) {
      const list = entry.side === 'buy' ? book.bids : book.asks;
      const at = this.locate(list, entry, entry.side);
      // `locate` lands on the first element that does not sort before `entry`;
      // sequences are unique, so that element is `entry` whenever it is present.
      if (list[at] === entry) {
        list.splice(at, 1);
      } else {
        const fallback = list.indexOf(entry);
        if (fallback >= 0) list.splice(fallback, 1);
      }
      if (book.bids.length === 0 && book.asks.length === 0) this.books.delete(entry.ticker);
    }
    return entry;
  }

  /**
   * Apply a fill to a resting order. Returns the entry still on the book, or
   * null once it is exhausted and has been removed.
   */
  reduce(orderId: number, filledQuantity: Fixed): BookOrder | null {
    const entry = this.index.get(orderId);
    if (!entry) return null;
    if (filledQuantity <= ZERO) return entry;
    entry.remaining -= filledQuantity;
    if (entry.remaining <= ZERO) {
      this.remove(orderId);
      return null;
    }
    return entry;
  }

  /** Forget a ticker entirely (delisting, admin removal). */
  drop(ticker: string): void {
    const key = ticker.toUpperCase();
    const book = this.books.get(key);
    if (!book) return;
    for (const entry of [...book.bids, ...book.asks]) this.index.delete(entry.id);
    this.books.delete(key);
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** Resting buys, best first. A copy: callers must not reorder the live book. */
  bids(ticker: string): BookOrder[] {
    return [...(this.books.get(ticker.toUpperCase())?.bids ?? [])];
  }

  /** Resting sells, best first. A copy: callers must not reorder the live book. */
  asks(ticker: string): BookOrder[] {
    return [...(this.books.get(ticker.toUpperCase())?.asks ?? [])];
  }

  /** The order that would trade next on `side`, or null when that side is empty. */
  best(ticker: string, side: Side): BookOrder | null {
    const book = this.books.get(ticker.toUpperCase());
    if (!book) return null;
    return (side === 'buy' ? book.bids[0] : book.asks[0]) ?? null;
  }

  /** The live entry for an order id, if it is resting. */
  get(orderId: number): BookOrder | null {
    return this.index.get(orderId) ?? null;
  }

  /** Number of resting orders on a ticker, both sides. */
  size(ticker: string): number {
    const book = this.books.get(ticker.toUpperCase());
    if (!book) return 0;
    return book.bids.length + book.asks.length;
  }

  /** Tickers that currently hold resting liquidity. */
  tickers(): string[] {
    return [...this.books.keys()];
  }

  /**
   * Best order on `side` that is not owned by the given account.
   *
   * Self-trade prevention lives here rather than in the matcher's loop so every
   * caller gets it: a player who could cross their own resting order would be
   * able to print any price they liked for the cost of two fees.
   */
  bestMatchable(ticker: string, side: Side, ownerKind: string, ownerId: number): BookOrder | null {
    const book = this.books.get(ticker.toUpperCase());
    if (!book) return null;
    const list = side === 'buy' ? book.bids : book.asks;
    for (const entry of list) {
      if (entry.remaining <= ZERO) continue;
      if (entry.ownerKind === ownerKind && entry.ownerId === ownerId) continue;
      return entry;
    }
    return null;
  }

  /**
   * Highest bid and lowest ask that cross and belong to different owners.
   * Returns null when the book is uncrossed, or when the only crossing pairs
   * would be self-trades.
   */
  bestCross(ticker: string): { bid: BookOrder; ask: BookOrder } | null {
    const book = this.books.get(ticker.toUpperCase());
    if (!book) return null;
    for (const bid of book.bids) {
      if (bid.remaining <= ZERO) continue;
      for (const ask of book.asks) {
        if (ask.remaining <= ZERO) continue;
        // Asks are price-ascending: once one is too expensive for this bid, so
        // is every ask behind it.
        if (ask.price > bid.price) break;
        if (ask.ownerKind === bid.ownerKind && ask.ownerId === bid.ownerId) continue;
        return { bid, ask };
      }
    }
    return null;
  }

  /** True when a resting bid and a resting ask overlap and could trade. */
  isCrossed(ticker: string): boolean {
    return this.bestCross(ticker) !== null;
  }

  /**
   * Aggregated depth for the public book endpoint and the `book:update` event.
   * Never throws for an unknown ticker — a market with no resting orders is a
   * normal state, not an error — and every value leaves as a fixed-point string.
   */
  snapshot(ticker: string, depth = 20): OrderBook {
    const key = ticker.toUpperCase();
    const book = this.books.get(key);
    const bestBid = book?.bids[0]?.price ?? ZERO;
    const bestAsk = book?.asks[0]?.price ?? ZERO;
    // A one-sided book has no meaningful spread; report zero rather than the
    // absolute price, which would render as an absurd number on the client.
    const spread = bestBid > ZERO && bestAsk > ZERO ? bestAsk - bestBid : ZERO;

    return {
      ticker: key,
      bids: aggregate(book?.bids ?? [], depth),
      asks: aggregate(book?.asks ?? [], depth),
      spread: spread.toString(),
      at: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private ensure(ticker: string): SideBook {
    let book = this.books.get(ticker);
    if (!book) {
      book = { bids: [], asks: [] };
      this.books.set(ticker, book);
    }
    return book;
  }

  /** Index of the first element that does not sort strictly before `probe`. */
  private locate(list: BookOrder[], probe: BookOrder, side: Side): number {
    let low = 0;
    let high = list.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const other = list[mid];
      if (other && comparePriority(other, probe, side) < 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }
}

/** Collapse consecutive same-price orders into the `zBookLevel` wire shape. */
function aggregate(list: readonly BookOrder[], depth: number): BookLevel[] {
  const levels: BookLevel[] = [];
  const wanted = Math.max(1, Math.trunc(depth));
  let price: Fixed | null = null;
  let quantity = ZERO;
  let count = 0;

  const flush = () => {
    if (price === null) return;
    levels.push({ price: price.toString(), quantity: quantity.toString(), orders: count });
    price = null;
    quantity = ZERO;
    count = 0;
  };

  const scanned = Math.min(list.length, MAX_SNAPSHOT_SCAN);
  for (let i = 0; i < scanned; i += 1) {
    const entry = list[i];
    if (!entry || entry.remaining <= ZERO) continue;
    if (price !== null && entry.price !== price) {
      flush();
      if (levels.length >= wanted) return levels;
    }
    price = entry.price;
    quantity += entry.remaining;
    count += 1;
  }
  flush();
  return levels.slice(0, wanted);
}
