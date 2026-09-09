import { and, eq, gt, lt, lte, sql } from 'drizzle-orm';
import {
  BANK,
  COMPANY,
  CURRENCY_CODE,
  LEADERBOARD,
  ZERO,
  mulRatio,
  units,
  type Fixed,
} from '@alvora/shared';
import { chatMessages, loginAttempts, marketEvents, otcOffers, sessions, users } from '@alvora/db';
import { random } from '../lib/random.js';
import { asUser, credit, lockBalances, releaseCash, releaseQuantity } from '../services/accounts.js';
import { payCompanySalaries, repriceListedCompanies, runCompanyRevenue } from '../services/companies.js';
import { closeExpiredMarkets } from '../services/predictions.js';
import { accrueLoanInterest } from '../services/loans.js';
import { accrueStakingRewards } from '../services/wallets.js';
import { checkPriceAlerts, refreshLeaderboard, snapshotNetWorth } from '../services/social.js';
import type { EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MS_PER_YEAR = 365 * DAY;

/** How often the dispatcher wakes up. Must divide the shortest job interval. */
const DISPATCH_INTERVAL_MS = SECOND;

/** A job that runs longer than this is logged: it is starving its own schedule. */
const SLOW_JOB_MS = 30 * SECOND;

/** Rows touched per pass of the batched jobs. */
const CHUNK = 200;

/** Ceiling on chunks per run, so a pathological table cannot pin the loop forever. */
const MAX_CHUNKS = 500;

/** Retention windows for the housekeeping job. */
const LOGIN_ATTEMPT_RETENTION_MS = DAY;
const MARKET_EVENT_RETENTION_MS = 7 * DAY;
const CHAT_RETENTION_MS = 30 * DAY;

/**
 * Idle cash below this earns nothing. Paying interest to every dormant account
 * would write one ledger row per user per hour for fractions of a centime.
 */
const SAVINGS_MIN_BALANCE: Fixed = units(1_000);

/**
 * Interest is pro-rated on the time actually elapsed, but a stalled event loop,
 * a clock jump or a paused container must not turn into a windfall.
 */
const SAVINGS_MAX_ELAPSED_MS = 6 * HOUR;

/** Below this, the elapsed window is too short to produce anything but dust. */
const SAVINGS_MIN_ELAPSED_MS = MINUTE;

interface Job {
  readonly name: string;
  readonly intervalMs: number;
  readonly run: () => Promise<void>;
}

interface JobState {
  readonly job: Job;
  /** Epoch ms of the next allowed start. */
  dueAt: number;
  running: boolean;
}

/**
 * Everything the world does between price ticks.
 *
 * The simulation loop only moves prices; companies still have to earn revenue and
 * pay salaries, loans have to accrue, markets have to settle and stale rows have
 * to disappear. The legacy app ran each of those from its own `setInterval` in a
 * Next.js route module, so a cold lambda meant they simply did not happen, and a
 * job that threw took its interval down silently for the rest of the process.
 *
 * Here one timer drives a table of jobs. Each job is independently guarded:
 *   - it never overlaps itself, so a slow pass cannot stack transactions;
 *   - its failures are caught and logged, so it cannot take the others down;
 *   - its first run is jittered, so a boot (or a restart of the whole fleet)
 *     does not fire twelve jobs against the database on the same millisecond.
 */
export class Scheduler implements EngineModule {
  readonly name = 'scheduler';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;

  private readonly states: JobState[] = [];
  private readonly inFlight = new Set<Promise<void>>();

  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  /** Start of the window the next savings accrual pays for. */
  private savingsAccruedAt = Date.now();

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.savingsAccruedAt = Date.now();

    const now = Date.now();
    this.states.length = 0;
    for (const job of this.jobs()) {
      this.states.push({ job, dueAt: now + initialDelay(job.intervalMs), running: false });
    }

    this.timer = setInterval(() => this.dispatch(), DISPATCH_INTERVAL_MS);
    // Nothing here is worth keeping the process alive on its own.
    this.timer.unref?.();
    this.ctx.log.info({ jobs: this.states.length }, 'scheduler started');
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // A job caught mid-transaction must be allowed to commit or roll back before
    // the pool is torn down, otherwise shutdown leaves half-applied economy state.
    if (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
    this.states.length = 0;
  }

  // -------------------------------------------------------------------------
  // The job table
  // -------------------------------------------------------------------------

  private jobs(): Job[] {
    const { db } = this.ctx;
    const engine = this.engine;
    return [
      { name: 'company-revenue', intervalMs: COMPANY.revenueIntervalMs, run: () => runCompanyRevenue(db, engine) },
      { name: 'company-salaries', intervalMs: HOUR, run: () => payCompanySalaries(db) },
      { name: 'company-reprice', intervalMs: 5 * MINUTE, run: () => repriceListedCompanies(db, engine) },
      { name: 'prediction-close', intervalMs: MINUTE, run: () => closeExpiredMarkets(db) },
      { name: 'loan-interest', intervalMs: BANK.accrualIntervalMs, run: () => accrueLoanInterest(db, engine) },
      { name: 'staking-rewards', intervalMs: 15 * MINUTE, run: () => accrueStakingRewards(db) },
      { name: 'price-alerts', intervalMs: 10 * SECOND, run: () => checkPriceAlerts(db, engine) },
      { name: 'leaderboard', intervalMs: LEADERBOARD.refreshMs, run: () => refreshLeaderboard(db, engine) },
      { name: 'net-worth-snapshot', intervalMs: 15 * MINUTE, run: () => snapshotNetWorth(db, engine) },
      { name: 'otc-expiry', intervalMs: MINUTE, run: () => this.expireOtcOffers() },
      { name: 'housekeeping', intervalMs: HOUR, run: () => this.housekeeping() },
      { name: 'savings-interest', intervalMs: HOUR, run: () => this.paySavingsInterest() },
    ];
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  private dispatch(): void {
    if (this.stopped) return;
    const now = Date.now();
    for (const state of this.states) {
      // `running` is the overlap guard: a pass that outlives its interval simply
      // skips the ticks it missed instead of running twice on the same rows.
      if (state.running || now < state.dueAt) continue;
      state.running = true;
      state.dueAt = now + state.job.intervalMs;

      const promise = this.execute(state);
      this.inFlight.add(promise);
      void promise.finally(() => {
        this.inFlight.delete(promise);
        state.running = false;
      });
    }
  }

  /** Never rejects: a failing job is logged and its schedule continues untouched. */
  private async execute(state: JobState): Promise<void> {
    const startedAt = Date.now();
    try {
      await state.job.run();
    } catch (error) {
      this.ctx.log.error({ err: error, job: state.job.name }, 'scheduled job failed');
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= SLOW_JOB_MS) {
        this.ctx.log.warn({ job: state.job.name, ms: elapsed }, 'scheduled job is slow');
      }
      // An overrunning job would otherwise be due the instant it finishes and
      // would then run continuously; give it a full interval of breathing room.
      if (Date.now() >= state.dueAt) state.dueAt = Date.now() + state.job.intervalMs;
    }
  }

  // -------------------------------------------------------------------------
  // OTC expiry
  // -------------------------------------------------------------------------

  /**
   * Expire offers past their deadline and hand the maker their escrow back.
   *
   * An OTC offer locks what the maker is giving away at creation time, so an
   * abandoned offer would otherwise freeze that value forever. The status is
   * re-read under a row lock inside the transaction because a taker may be
   * accepting the very same offer as this pass runs — whoever locks first wins,
   * and the loser sees a status that is no longer `open` and does nothing.
   */
  private async expireOtcOffers(): Promise<void> {
    let expired = 0;

    for (let chunk = 0; chunk < MAX_CHUNKS; chunk += 1) {
      const due = await this.ctx.db
        .select({ id: otcOffers.id })
        .from(otcOffers)
        .where(and(eq(otcOffers.status, 'open'), lte(otcOffers.expiresAt, new Date())))
        .orderBy(otcOffers.id)
        .limit(CHUNK);
      if (due.length === 0) break;

      for (const { id } of due) {
        const released = await this.ctx.db.transaction(async (tx) => {
          const [offer] = await tx
            .select({
              id: otcOffers.id,
              makerId: otcOffers.makerId,
              offerTicker: otcOffers.offerTicker,
              offerQuantity: otcOffers.offerQuantity,
              status: otcOffers.status,
            })
            .from(otcOffers)
            .where(eq(otcOffers.id, id))
            .for('update');
          if (!offer || offer.status !== 'open') return false;

          await tx
            .update(otcOffers)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(otcOffers.id, offer.id));

          const maker = asUser(offer.makerId);
          if (isCashTicker(offer.offerTicker)) {
            await releaseCash(tx, maker, offer.offerQuantity);
          } else {
            await releaseQuantity(tx, maker, offer.offerTicker, offer.offerQuantity);
          }
          return true;
        });
        if (released) expired += 1;
      }

      if (due.length < CHUNK) break;
    }

    if (expired > 0) this.ctx.log.info({ expired }, 'expired OTC offers');
  }

  // -------------------------------------------------------------------------
  // Housekeeping
  // -------------------------------------------------------------------------

  /**
   * Drop rows nobody can ever read again. Each table is deleted independently:
   * a lock conflict on chat must not leave expired sessions replayable.
   */
  private async housekeeping(): Promise<void> {
    const now = Date.now();
    const steps: { table: string; run: () => Promise<number> }[] = [
      {
        table: 'sessions',
        run: async () => {
          const result = await this.ctx.db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
          return result.count;
        },
      },
      {
        table: 'login_attempts',
        run: async () => {
          const result = await this.ctx.db
            .delete(loginAttempts)
            .where(lt(loginAttempts.createdAt, new Date(now - LOGIN_ATTEMPT_RETENTION_MS)));
          return result.count;
        },
      },
      {
        table: 'market_events',
        run: async () => {
          const result = await this.ctx.db
            .delete(marketEvents)
            .where(lt(marketEvents.createdAt, new Date(now - MARKET_EVENT_RETENTION_MS)));
          return result.count;
        },
      },
      {
        table: 'chat_messages',
        run: async () => {
          const result = await this.ctx.db
            .delete(chatMessages)
            .where(lt(chatMessages.createdAt, new Date(now - CHAT_RETENTION_MS)));
          return result.count;
        },
      },
    ];

    const deleted: Record<string, number> = {};
    for (const step of steps) {
      try {
        const count = await step.run();
        if (count > 0) deleted[step.table] = count;
      } catch (error) {
        this.ctx.log.error({ err: error, table: step.table }, 'housekeeping delete failed');
      }
    }
    if (Object.keys(deleted).length > 0) this.ctx.log.info({ deleted }, 'housekeeping complete');
  }

  // -------------------------------------------------------------------------
  // Savings interest
  // -------------------------------------------------------------------------

  /**
   * Credit interest on idle cash, pro-rated on the elapsed window rather than on
   * the nominal interval: a missed or delayed pass must pay exactly the time it
   * covers, never a full hour twice.
   *
   * Locked cash earns nothing — it is already committed to a resting order or an
   * escrow, and paying on it would let a player farm interest by parking capital
   * in orders that can never fill.
   */
  private async paySavingsInterest(): Promise<void> {
    const now = Date.now();
    const elapsed = Math.min(Math.max(now - this.savingsAccruedAt, 0), SAVINGS_MAX_ELAPSED_MS);
    if (elapsed < SAVINGS_MIN_ELAPSED_MS) return;

    // Claim the window before doing any work: if this pass throws halfway, the
    // accounts already paid must not be paid again for the same seconds.
    this.savingsAccruedAt = now;

    const numerator = BigInt(BANK.savingsApyBps) * BigInt(elapsed);
    const denominator = 10_000n * BigInt(MS_PER_YEAR);
    const description = 'Intérêts sur liquidités disponibles';

    let cursor = 0;
    let paid = 0;
    let total: Fixed = ZERO;

    for (let chunk = 0; chunk < MAX_CHUNKS; chunk += 1) {
      const batch = await this.ctx.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.status, 'active'),
            gt(users.id, cursor),
            sql`${users.cash} - ${users.lockedCash} >= ${sql.raw(SAVINGS_MIN_BALANCE.toString())}::numeric`,
          ),
        )
        .orderBy(users.id)
        .limit(CHUNK);
      if (batch.length === 0) break;

      const last = batch[batch.length - 1];
      if (!last) break;
      cursor = last.id;

      // One transaction per chunk: a transaction per user would be 100k round
      // trips on a populated instance, and a single one over every user would
      // hold locks on the whole table for the length of the pass.
      const credited = await this.ctx.db.transaction(async (tx) => {
        let batchTotal: Fixed = ZERO;
        let batchPaid = 0;
        for (const { id } of batch) {
          const owner = asUser(id);
          // Re-read under the row lock: the candidate list is a snapshot and the
          // balance may have been spent between the SELECT and this transaction.
          const { cash, lockedCash } = await lockBalances(tx, owner);
          const idle = cash - lockedCash;
          if (idle < SAVINGS_MIN_BALANCE) continue;

          const interest = mulRatio(idle, numerator, denominator, 'trunc');
          if (interest <= ZERO) continue;

          await credit(tx, owner, interest, { kind: 'interest', description });
          batchTotal += interest;
          batchPaid += 1;
        }
        return { batchTotal, batchPaid };
      });

      total += credited.batchTotal;
      paid += credited.batchPaid;

      if (batch.length < CHUNK) break;
    }

    if (paid > 0) {
      this.ctx.log.info({ accounts: paid, total: total.toString(), elapsedMs: elapsed }, 'savings interest paid');
    }
  }
}

/**
 * First run of a job lands somewhere inside its interval instead of on boot, so
 * twelve jobs (and every API instance restarted together) do not hit the database
 * at the same instant.
 */
function initialDelay(intervalMs: number): number {
  return Math.round(intervalMs * (0.25 + random.next() * 0.5));
}

/**
 * An OTC offer escrows either an asset position or cash, and the maker's side is
 * identified by its ticker. The platform currency is not an `assets` row, so a
 * cash-denominated offer carries the currency code rather than a real ticker.
 */
function isCashTicker(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return upper === CURRENCY_CODE || upper === 'CASH';
}
