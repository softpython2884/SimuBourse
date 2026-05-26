import 'server-only';
import { db, rawSqlite } from './index';

/**
 * Manual BEGIN/COMMIT wrapper around an async function.
 *
 * better-sqlite3 v11+ rejects `db.transaction(async (tx) => ...)` because the
 * function returns a Promise. But better-sqlite3 itself is synchronous — all
 * drizzle queries resolve their underlying SQL calls synchronously and only
 * wrap the result in an already-resolved Promise for API compatibility.
 *
 * So we can safely BEGIN, run the async function (whose `await`s are no-ops
 * for resolved promises), and COMMIT — all within a single JS event-loop tick
 * for typical actions that only do drizzle calls. ROLLBACK on throw.
 *
 * Caveat: if your `fn` awaits something genuinely async (network, fs, bcrypt),
 * the transaction will straddle event-loop yields, and a concurrent request
 * could try to BEGIN and fail. Don't put bcrypt / fetch / fs inside.
 */
// Serialize all transactions through a single promise chain. Because the
// connection is shared and `fn` straddles event-loop yields, two concurrent
// callers could otherwise both run BEGIN and trip "cannot start a transaction
// within a transaction". This mutex guarantees one transaction at a time.
let chain: Promise<unknown> = Promise.resolve();

export async function runTransaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    rawSqlite.prepare('BEGIN').run();
    try {
      const result = await fn(db);
      rawSqlite.prepare('COMMIT').run();
      return result;
    } catch (err) {
      try { rawSqlite.prepare('ROLLBACK').run(); } catch {}
      throw err;
    }
  };

  // Queue behind any in-flight transaction; don't let one caller's failure
  // break the chain for the next caller.
  const result = chain.then(run, run);
  chain = result.then(() => undefined, () => undefined);
  return result;
}
