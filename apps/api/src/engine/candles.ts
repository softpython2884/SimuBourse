import { and, eq, lt, or, sql } from 'drizzle-orm';
import { CANDLE_INTERVALS, ENGINE, ZERO, type Candle, type CandleInterval, type Fixed } from '@alvora/shared';
import { candles } from '@alvora/db';
import type { EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

const MINUTE = 60_000;

/** Bucket width per interval. Every width divides a UTC day, so buckets align to midnight. */
const INTERVAL_MS: Record<CandleInterval, number> = {
  '1m': MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '1h': 60 * MINUTE,
  '4h': 240 * MINUTE,
  '1d': 1_440 * MINUTE,
};

/**
 * How long each resolution is kept. Minute candles are only useful for the live
 * chart and are by far the most numerous (1 440 rows per asset per day), so they
 * age out fast; daily candles are the asset's history and are never dropped.
 */
const RETENTION_MS: Record<CandleInterval, number | null> = {
  '1m': 2 * 24 * 3_600_000,
  '5m': 7 * 24 * 3_600_000,
  '15m': 21 * 24 * 3_600_000,
  '1h': 120 * 24 * 3_600_000,
  '4h': 365 * 24 * 3_600_000,
  '1d': null,
};

const PRUNE_INTERVAL_MS = 6 * 3_600_000;
const FIRST_PRUNE_DELAY_MS = 60_000;

/** Rows per INSERT. Keeps the statement well under any parameter limit. */
const FLUSH_CHUNK = 400;

/**
 * Ceiling on queued closed buckets. Reached only if the database has been
 * unreachable for a long time; dropping the oldest is better than growing the
 * heap until the process dies.
 */
const MAX_QUEUED = 20_000;

interface Bucket {
  start: number;
  open: Fixed;
  high: Fixed;
  low: Fixed;
  close: Fixed;
  volume: Fixed;
  trades: number;
  /** Set on every mutation, cleared once the row has reached the database. */
  dirty: boolean;
}

interface QueuedBucket {
  ticker: string;
  interval: CandleInterval;
  bucket: Bucket;
}

/**
 * OHLCV aggregation.
 *
 * Candles are built in memory and flushed in batches: a chart that updates every
 * two seconds cannot afford a write per print. Both trades and simulated ticks
 * feed the buckets, so an asset that nobody traded still has a continuous chart
 * instead of the flat gaps the legacy app drew.
 */
export class CandleAggregator implements EngineModule {
  readonly name = 'candles';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;

  private readonly buckets = new Map<string, Map<CandleInterval, Bucket>>();
  private readonly queued: QueuedBucket[] = [];

  private flushTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private firstPruneTimer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;
  private flushing = false;

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  async start(): Promise<void> {
    if (this.flushTimer) return;
    await this.warm();
    this.seed();

    // Assets with no order flow still need candles, otherwise their chart would
    // be a single point between trades even though the price is moving.
    this.unsubscribe = this.ctx.bus.on('tick', ({ ticks, at }) => {
      for (const tick of ticks) {
        try {
          this.apply(tick.ticker, BigInt(tick.price), ZERO, false, at);
        } catch (error) {
          this.ctx.log.error({ err: error, ticker: tick.ticker }, 'candle tick update failed');
        }
      }
    });

    this.flushTimer = setInterval(() => void this.flush(), ENGINE.candleFlushMs);
    this.firstPruneTimer = setTimeout(() => void this.prune(), FIRST_PRUNE_DELAY_MS);
    this.pruneTimer = setInterval(() => void this.prune(), PRUNE_INTERVAL_MS);
    this.ctx.log.info({ intervals: CANDLE_INTERVALS.length }, 'candle aggregator started');
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.firstPruneTimer) clearTimeout(this.firstPruneTimer);
    this.flushTimer = null;
    this.pruneTimer = null;
    this.firstPruneTimer = null;
    // Live buckets are written as partial candles so a restart resumes them
    // through warm() instead of reopening at a bogus price.
    await this.flush();
  }

  /** Called synchronously by `Engine.recordTrade` — must never block the fill path. */
  record(ticker: string, price: Fixed, quantity: Fixed): void {
    try {
      this.apply(ticker, price, quantity, true, Date.now());
    } catch (error) {
      this.ctx.log.error({ err: error, ticker }, 'candle trade update failed');
    }
  }

  // -------------------------------------------------------------------------
  // Aggregation
  // -------------------------------------------------------------------------

  private apply(rawTicker: string, price: Fixed, quantity: Fixed, isTrade: boolean, at: number): void {
    if (price <= ZERO) return;
    const ticker = rawTicker.toUpperCase();

    let book = this.buckets.get(ticker);
    if (!book) {
      book = new Map<CandleInterval, Bucket>();
      this.buckets.set(ticker, book);
    }

    for (const interval of CANDLE_INTERVALS) {
      const start = bucketStart(at, interval);
      let bucket = book.get(interval);

      if (!bucket || bucket.start !== start) {
        if (bucket) this.close(ticker, interval, bucket);
        bucket = { start, open: price, high: price, low: price, close: price, volume: ZERO, trades: 0, dirty: true };
        book.set(interval, bucket);
      }

      if (price > bucket.high) bucket.high = price;
      if (price < bucket.low) bucket.low = price;
      bucket.close = price;
      if (isTrade) {
        bucket.volume += quantity;
        bucket.trades += 1;
      }
      bucket.dirty = true;
    }
  }

  private close(ticker: string, interval: CandleInterval, bucket: Bucket): void {
    this.queued.push({ ticker, interval, bucket });
    if (this.queued.length > MAX_QUEUED) {
      const dropped = this.queued.splice(0, this.queued.length - MAX_QUEUED);
      this.ctx.log.warn({ dropped: dropped.length }, 'candle queue overflow, oldest buckets discarded');
    }
    this.ctx.bus.emit('candle', { ticker, interval, candle: toCandle(bucket) });
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Reload the bucket currently in progress for every ticker/interval pair so a
   * restart mid-minute continues the candle it left instead of opening a new one
   * at whatever the price happens to be at boot.
   */
  private async warm(): Promise<void> {
    const at = Date.now();
    const conditions = CANDLE_INTERVALS.map((interval) =>
      and(eq(candles.interval, interval), eq(candles.bucket, new Date(bucketStart(at, interval)))),
    );

    try {
      const rows = await this.ctx.db.select().from(candles).where(or(...conditions));
      for (const row of rows) {
        const interval = row.interval as CandleInterval;
        if (!INTERVAL_MS[interval]) continue;
        let book = this.buckets.get(row.ticker);
        if (!book) {
          book = new Map<CandleInterval, Bucket>();
          this.buckets.set(row.ticker, book);
        }
        book.set(interval, {
          start: row.bucket.getTime(),
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
          trades: row.trades,
          dirty: false,
        });
      }
      this.ctx.log.info({ warmed: rows.length }, 'candle buckets restored');
    } catch (error) {
      // A cold start with empty buckets is degraded, not fatal: the first tick
      // opens fresh ones and the upsert repairs the row.
      this.ctx.log.error({ err: error }, 'failed to warm candle buckets');
    }
  }

  /**
   * Open a bucket for every live asset at its current price. Without this an
   * asset that has just been listed shows an empty chart until its first trade.
   */
  private seed(): void {
    const at = Date.now();
    for (const state of this.engine.all()) {
      if (!state.isTradable || state.price <= ZERO) continue;
      try {
        this.apply(state.ticker, state.price, ZERO, false, at);
      } catch (error) {
        this.ctx.log.error({ err: error, ticker: state.ticker }, 'candle seed failed');
      }
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;

    const closed = this.queued.splice(0, this.queued.length);
    const rows: (typeof candles.$inferInsert)[] = closed.map((entry) => toRow(entry.ticker, entry.interval, entry.bucket));

    for (const [ticker, book] of this.buckets) {
      for (const [interval, bucket] of book) {
        if (!bucket.dirty) continue;
        rows.push(toRow(ticker, interval, bucket));
        bucket.dirty = false;
      }
    }

    if (rows.length === 0) {
      this.flushing = false;
      return;
    }

    try {
      for (let i = 0; i < rows.length; i += FLUSH_CHUNK) {
        const chunk = rows.slice(i, i + FLUSH_CHUNK);
        await this.ctx.db
          .insert(candles)
          .values(chunk)
          .onConflictDoUpdate({
            target: [candles.ticker, candles.interval, candles.bucket],
            set: {
              // `open` is deliberately never overwritten: the first price of the
              // bucket is already on the row and a later flush must not move it.
              high: sql`greatest(${candles.high}, excluded.high)`,
              low: sql`least(${candles.low}, excluded.low)`,
              close: sql`excluded.close`,
              volume: sql`greatest(${candles.volume}, excluded.volume)`,
              trades: sql`greatest(${candles.trades}, excluded.trades)`,
            },
          });
      }
    } catch (error) {
      // Closed buckets are the only rows that cannot be regenerated, so put them
      // back at the head of the queue and retry on the next flush.
      this.queued.unshift(...closed);
      this.ctx.log.error({ err: error, rows: rows.length }, 'failed to flush candles');
    } finally {
      this.flushing = false;
    }
  }

  private async prune(): Promise<void> {
    const at = Date.now();
    for (const interval of CANDLE_INTERVALS) {
      const retention = RETENTION_MS[interval];
      if (retention === null) continue;
      try {
        await this.ctx.db
          .delete(candles)
          .where(and(eq(candles.interval, interval), lt(candles.bucket, new Date(at - retention))));
      } catch (error) {
        this.ctx.log.error({ err: error, interval }, 'failed to prune candles');
      }
    }
  }
}

function bucketStart(at: number, interval: CandleInterval): number {
  const size = INTERVAL_MS[interval];
  return Math.floor(at / size) * size;
}

function toCandle(bucket: Bucket): Candle {
  return {
    t: bucket.start,
    o: bucket.open.toString(),
    h: bucket.high.toString(),
    l: bucket.low.toString(),
    c: bucket.close.toString(),
    v: bucket.volume.toString(),
  };
}

function toRow(ticker: string, interval: CandleInterval, bucket: Bucket): typeof candles.$inferInsert {
  return {
    ticker,
    interval,
    bucket: new Date(bucket.start),
    open: bucket.open,
    high: bucket.high,
    low: bucket.low,
    close: bucket.close,
    volume: bucket.volume,
    trades: bucket.trades,
  };
}
