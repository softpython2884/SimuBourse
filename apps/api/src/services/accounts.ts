import { and, eq, sql } from 'drizzle-orm';
import { AppError, ZERO, div, mul, notional, type Fixed } from '@alvora/shared';
import { companies, holdings, ledger, users, type Transaction } from '@alvora/db';

/**
 * Cash and position accounting.
 *
 * Every function here must run inside a database transaction and takes a row lock
 * before reading a balance it is about to change. The legacy app read a balance,
 * computed a new one in JS and wrote it back without locking, so two concurrent
 * orders could both pass the "enough cash?" check and overdraw the account.
 *
 * Invariants enforced on every write:
 *   cash >= 0,  lockedCash >= 0,  lockedCash <= cash
 *   quantity >= 0,  lockedQuantity >= 0,  lockedQuantity <= quantity
 */

export type OwnerKind = 'user' | 'company';

export interface Owner {
  kind: OwnerKind;
  id: number;
}

export const asUser = (id: number): Owner => ({ kind: 'user', id });
export const asCompany = (id: number): Owner => ({ kind: 'company', id });

export interface LedgerContext {
  kind: string;
  description: string;
  ticker?: string | null;
  quantity?: Fixed | null;
  price?: Fixed | null;
  counterparty?: Owner | null;
  refType?: string | null;
  refId?: number | null;
}

interface Balances {
  cash: Fixed;
  lockedCash: Fixed;
}

/** Read and lock the owner's cash row. Blocks concurrent writers until commit. */
export async function lockBalances(tx: Transaction, owner: Owner): Promise<Balances> {
  if (owner.kind === 'user') {
    const [row] = await tx
      .select({ cash: users.cash, lockedCash: users.lockedCash })
      .from(users)
      .where(eq(users.id, owner.id))
      .for('update');
    if (!row) throw AppError.notFound('Compte introuvable.');
    return row;
  }
  const [row] = await tx
    .select({ cash: companies.treasury, lockedCash: companies.lockedTreasury })
    .from(companies)
    .where(eq(companies.id, owner.id))
    .for('update');
  if (!row) throw AppError.notFound('Entreprise introuvable.');
  return row;
}

/** Cash the owner may actually spend right now. */
export async function availableCash(tx: Transaction, owner: Owner): Promise<Fixed> {
  const { cash, lockedCash } = await lockBalances(tx, owner);
  return cash - lockedCash;
}

async function writeCash(tx: Transaction, owner: Owner, cash: Fixed, lockedCash: Fixed): Promise<void> {
  if (cash < ZERO) throw AppError.insufficientFunds();
  if (lockedCash < ZERO || lockedCash > cash) {
    throw new AppError('INTERNAL', 'Incohérence de réservation de trésorerie.', 500);
  }
  if (owner.kind === 'user') {
    await tx.update(users).set({ cash, lockedCash, updatedAt: new Date() }).where(eq(users.id, owner.id));
  } else {
    await tx
      .update(companies)
      .set({ treasury: cash, lockedTreasury: lockedCash, updatedAt: new Date() })
      .where(eq(companies.id, owner.id));
  }
}

async function recordLedger(
  tx: Transaction,
  owner: Owner,
  amount: Fixed,
  balanceAfter: Fixed,
  context: LedgerContext,
): Promise<void> {
  await tx.insert(ledger).values({
    ownerKind: owner.kind,
    ownerId: owner.id,
    kind: context.kind,
    amount,
    balanceAfter,
    ticker: context.ticker ?? null,
    quantity: context.quantity ?? null,
    price: context.price ?? null,
    description: context.description,
    counterpartyKind: context.counterparty?.kind ?? null,
    counterpartyId: context.counterparty?.id ?? null,
    refType: context.refType ?? null,
    refId: context.refId ?? null,
  });
}

/** Add cash and write the matching ledger row. `amount` must be positive. */
export async function credit(tx: Transaction, owner: Owner, amount: Fixed, context: LedgerContext): Promise<Fixed> {
  if (amount < ZERO) throw new AppError('INTERNAL', 'credit() requires a positive amount', 500);
  if (amount === ZERO) return (await lockBalances(tx, owner)).cash;
  const { cash, lockedCash } = await lockBalances(tx, owner);
  const next = cash + amount;
  await writeCash(tx, owner, next, lockedCash);
  await recordLedger(tx, owner, amount, next, context);
  return next;
}

/**
 * Remove cash and write the matching ledger row.
 * `fromLocked` spends against a prior reservation instead of free cash.
 */
export async function debit(
  tx: Transaction,
  owner: Owner,
  amount: Fixed,
  context: LedgerContext,
  fromLocked = false,
): Promise<Fixed> {
  if (amount < ZERO) throw new AppError('INTERNAL', 'debit() requires a positive amount', 500);
  if (amount === ZERO) return (await lockBalances(tx, owner)).cash;
  const { cash, lockedCash } = await lockBalances(tx, owner);

  if (fromLocked) {
    if (amount > lockedCash) throw AppError.insufficientFunds('Réservation insuffisante.');
    await writeCash(tx, owner, cash - amount, lockedCash - amount);
  } else {
    if (amount > cash - lockedCash) throw AppError.insufficientFunds();
    await writeCash(tx, owner, cash - amount, lockedCash);
  }
  const next = cash - amount;
  await recordLedger(tx, owner, -amount, next, context);
  return next;
}

/** Move cash between two accounts atomically, writing both ledger rows. */
export async function transferCash(
  tx: Transaction,
  from: Owner,
  to: Owner,
  amount: Fixed,
  context: { kind: string; description: string; refType?: string; refId?: number },
): Promise<void> {
  if (from.kind === to.kind && from.id === to.id) {
    throw AppError.validation('Impossible de transférer vers le même compte.');
  }
  // Always lock in a stable order so two opposing transfers cannot deadlock.
  const [first, second] = orderOwners(from, to);
  await lockBalances(tx, first);
  await lockBalances(tx, second);

  await debit(tx, from, amount, { ...context, counterparty: to });
  await credit(tx, to, amount, { ...context, counterparty: from });
}

function orderOwners(a: Owner, b: Owner): [Owner, Owner] {
  const key = (o: Owner) => `${o.kind}:${String(o.id).padStart(12, '0')}`;
  return key(a) <= key(b) ? [a, b] : [b, a];
}

/** Reserve cash for a resting buy order. Reserved cash is not spendable elsewhere. */
export async function reserveCash(tx: Transaction, owner: Owner, amount: Fixed): Promise<void> {
  if (amount <= ZERO) return;
  const { cash, lockedCash } = await lockBalances(tx, owner);
  if (amount > cash - lockedCash) throw AppError.insufficientFunds();
  await writeCash(tx, owner, cash, lockedCash + amount);
}

/** Release a reservation without spending it (order cancelled or over-reserved). */
export async function releaseCash(tx: Transaction, owner: Owner, amount: Fixed): Promise<void> {
  if (amount <= ZERO) return;
  const { cash, lockedCash } = await lockBalances(tx, owner);
  const release = amount > lockedCash ? lockedCash : amount;
  await writeCash(tx, owner, cash, lockedCash - release);
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export interface HoldingRow {
  id: number;
  quantity: Fixed;
  lockedQuantity: Fixed;
  averageCost: Fixed;
  realizedPnl: Fixed;
}

/** Read and lock a position, creating an empty one if the owner has none. */
export async function lockHolding(tx: Transaction, owner: Owner, ticker: string): Promise<HoldingRow> {
  const [existing] = await tx
    .select({
      id: holdings.id,
      quantity: holdings.quantity,
      lockedQuantity: holdings.lockedQuantity,
      averageCost: holdings.averageCost,
      realizedPnl: holdings.realizedPnl,
    })
    .from(holdings)
    .where(and(eq(holdings.ownerKind, owner.kind), eq(holdings.ownerId, owner.id), eq(holdings.ticker, ticker)))
    .for('update');
  if (existing) return existing;

  // ON CONFLICT so two concurrent first-buys cannot both insert.
  await tx
    .insert(holdings)
    .values({ ownerKind: owner.kind, ownerId: owner.id, ticker })
    .onConflictDoNothing({ target: [holdings.ownerKind, holdings.ownerId, holdings.ticker] });

  const [created] = await tx
    .select({
      id: holdings.id,
      quantity: holdings.quantity,
      lockedQuantity: holdings.lockedQuantity,
      averageCost: holdings.averageCost,
      realizedPnl: holdings.realizedPnl,
    })
    .from(holdings)
    .where(and(eq(holdings.ownerKind, owner.kind), eq(holdings.ownerId, owner.id), eq(holdings.ticker, ticker)))
    .for('update');
  if (!created) throw new AppError('INTERNAL', 'Impossible de créer la position.', 500);
  return created;
}

/**
 * Add to a position, recomputing the weighted average cost.
 * Average cost is derived from exact integers, so it cannot drift the way a
 * running float average does over thousands of trades.
 */
export async function addToPosition(
  tx: Transaction,
  owner: Owner,
  ticker: string,
  quantity: Fixed,
  pricePerUnit: Fixed,
): Promise<void> {
  if (quantity <= ZERO) return;
  const row = await lockHolding(tx, owner, ticker);
  const previousCost = mul(row.quantity, row.averageCost);
  const addedCost = mul(quantity, pricePerUnit);
  const nextQuantity = row.quantity + quantity;
  const nextAverage = nextQuantity === ZERO ? ZERO : div(previousCost + addedCost, nextQuantity);
  await tx
    .update(holdings)
    .set({ quantity: nextQuantity, averageCost: nextAverage, updatedAt: new Date() })
    .where(eq(holdings.id, row.id));
}

/**
 * Remove from a position and return the realized profit or loss.
 * Only unlocked quantity may be removed unless `fromLocked` is set, which spends
 * a reservation made by a resting sell order.
 */
export async function removeFromPosition(
  tx: Transaction,
  owner: Owner,
  ticker: string,
  quantity: Fixed,
  pricePerUnit: Fixed,
  fromLocked = false,
): Promise<Fixed> {
  if (quantity <= ZERO) return ZERO;
  const row = await lockHolding(tx, owner, ticker);

  const spendable = fromLocked ? row.lockedQuantity : row.quantity - row.lockedQuantity;
  if (quantity > spendable) throw AppError.insufficientQuantity();

  const proceeds = notional(quantity, pricePerUnit);
  const costBasis = notional(quantity, row.averageCost);
  const realized = proceeds - costBasis;

  const nextQuantity = row.quantity - quantity;
  const nextLocked = fromLocked ? row.lockedQuantity - quantity : row.lockedQuantity;

  await tx
    .update(holdings)
    .set({
      quantity: nextQuantity,
      lockedQuantity: nextLocked,
      // Zeroing the average on a fully closed position keeps the next opening
      // trade from inheriting a stale basis.
      averageCost: nextQuantity === ZERO ? ZERO : row.averageCost,
      realizedPnl: row.realizedPnl + realized,
      updatedAt: new Date(),
    })
    .where(eq(holdings.id, row.id));

  if (owner.kind === 'user') {
    await tx
      .update(users)
      .set({ realizedPnl: sql`${users.realizedPnl} + ${realized.toString()}::numeric` })
      .where(eq(users.id, owner.id));
  }
  return realized;
}

/** Reserve quantity for a resting sell order. */
export async function reserveQuantity(tx: Transaction, owner: Owner, ticker: string, quantity: Fixed): Promise<void> {
  if (quantity <= ZERO) return;
  const row = await lockHolding(tx, owner, ticker);
  if (quantity > row.quantity - row.lockedQuantity) throw AppError.insufficientQuantity();
  await tx
    .update(holdings)
    .set({ lockedQuantity: row.lockedQuantity + quantity, updatedAt: new Date() })
    .where(eq(holdings.id, row.id));
}

/** Release a quantity reservation without selling it. */
export async function releaseQuantity(tx: Transaction, owner: Owner, ticker: string, quantity: Fixed): Promise<void> {
  if (quantity <= ZERO) return;
  const row = await lockHolding(tx, owner, ticker);
  const release = quantity > row.lockedQuantity ? row.lockedQuantity : quantity;
  await tx
    .update(holdings)
    .set({ lockedQuantity: row.lockedQuantity - release, updatedAt: new Date() })
    .where(eq(holdings.id, row.id));
}

/** Move a position between two owners without touching cash (OTC settlement, IPO). */
export async function transferPosition(
  tx: Transaction,
  from: Owner,
  to: Owner,
  ticker: string,
  quantity: Fixed,
  pricePerUnit: Fixed,
  fromLocked = false,
): Promise<void> {
  await removeFromPosition(tx, from, ticker, quantity, pricePerUnit, fromLocked);
  await addToPosition(tx, to, ticker, quantity, pricePerUnit);
}
