import 'server-only';
import { db } from './db';
import { runTransaction } from './db/tx';
import { predictionMarkets, marketOutcomes, marketBets, users } from './db/schema';
import { eq, and, lt, sql, isNotNull } from 'drizzle-orm';

type MarketEvent =
  | { type: 'closed'; marketId: number }
  | { type: 'settled'; marketId: number; winningOutcomeId: number };

type Listener = (event: MarketEvent) => void;

declare global {
  var __marketsResolver: {
    listeners: Set<Listener>;
    timer: NodeJS.Timeout | null;
  } | undefined;
}

function getState() {
  if (!globalThis.__marketsResolver) {
    globalThis.__marketsResolver = { listeners: new Set(), timer: null };
  }
  return globalThis.__marketsResolver;
}

async function closeExpiredMarkets() {
  const now = new Date();
  const expired = await db.query.predictionMarkets.findMany({
    where: and(eq(predictionMarkets.status, 'open'), lt(predictionMarkets.closingAt, now)),
    columns: { id: true },
  });
  if (expired.length === 0) return;

  await db.update(predictionMarkets)
    .set({ status: 'closed' })
    .where(and(eq(predictionMarkets.status, 'open'), lt(predictionMarkets.closingAt, now)));

  const state = getState();
  for (const m of expired) {
    for (const fn of state.listeners) {
      try { fn({ type: 'closed', marketId: m.id }); } catch (err) { console.error(err); }
    }
  }
}

async function settleMarketsWithWinners() {
  // Markets that have a winning outcome set AND are still in 'closed' status.
  const markets = await db.query.predictionMarkets.findMany({
    where: and(eq(predictionMarkets.status, 'closed'), isNotNull(predictionMarkets.winningOutcomeId)),
    with: { outcomes: true },
  });

  for (const market of markets) {
    if (market.winningOutcomeId == null) continue;

    const winningOutcome = market.outcomes.find(o => o.id === market.winningOutcomeId);
    if (!winningOutcome) continue;

    // Parimutuel payout: each winner gets a proportional share of the total pool.
    // payout = (bet.amount / winningOutcome.pool) * totalPool
    // Only pay still-active bets so a re-run can never double-pay a winner.
    await runTransaction(async (tx) => {
      const allBets = await tx.query.marketBets.findMany({
        where: and(eq(marketBets.outcomeId, market.winningOutcomeId!), eq(marketBets.status, 'active')),
      });

      for (const bet of allBets) {
        const payout = winningOutcome.pool > 0
          ? (bet.amount / winningOutcome.pool) * market.totalPool
          : bet.amount; // refund if winning pool was empty (shouldn't happen)

        await tx.update(users).set({ cash: sql`cash + ${payout}` }).where(eq(users.id, bet.userId));
        await tx.update(marketBets).set({ status: 'won', payout }).where(eq(marketBets.id, bet.id));
      }

      // Mark losing bets explicitly.
      const losingOutcomeIds = market.outcomes
        .filter(o => o.id !== market.winningOutcomeId)
        .map(o => o.id);
      if (losingOutcomeIds.length > 0) {
        // Drizzle doesn't have a single batched update with inArray on this version path,
        // so loop. Each is a tiny indexed update.
        for (const oid of losingOutcomeIds) {
          await tx.update(marketBets)
            .set({ status: 'lost', payout: 0 })
            .where(and(eq(marketBets.outcomeId, oid), eq(marketBets.status, 'active')));
        }
      }

      await tx.update(predictionMarkets).set({ status: 'settled' }).where(eq(predictionMarkets.id, market.id));
    });

    const state = getState();
    for (const fn of state.listeners) {
      try { fn({ type: 'settled', marketId: market.id, winningOutcomeId: market.winningOutcomeId! }); } catch (err) { console.error(err); }
    }
  }
}

async function tick() {
  try {
    await closeExpiredMarkets();
    await settleMarketsWithWinners();
  } catch (err) {
    console.error('[markets-resolver] tick error:', err);
  }
}

export function startMarketsResolver() {
  const state = getState();
  if (state.timer) return;
  state.timer = setInterval(tick, 60_000);
  // Run once at startup so we don't wait a full minute on boot.
  tick();
  console.log('[markets-resolver] Started.');
}

export function subscribeMarkets(fn: Listener): () => void {
  const state = getState();
  state.listeners.add(fn);
  return () => { state.listeners.delete(fn); };
}
