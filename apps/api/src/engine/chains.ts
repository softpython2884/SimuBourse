import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  CHAINS,
  CHAIN_SYMBOLS,
  MINING,
  WALLET,
  ZERO,
  mulRatio,
  parseDecimal,
  toDecimalString,
  type ChainSymbol,
  type Fixed,
} from '@alvora/shared';
import { chainBlocks, chainTransactions, wallets, type Transaction } from '@alvora/db';
import { generateBlockHash } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { random } from '../lib/random.js';
import { activeMiningPool, resolveNotifyTarget } from './mining.js';
import type { EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

export type FeePriority = 'low' | 'normal' | 'high';

/**
 * What each priority pays, relative to the chain's base fee. Paying more is only
 * worth it because it also buys fewer required confirmations below, so the two
 * tables have to be read together.
 */
const PRIORITY_FEE_BPS: Record<FeePriority, number> = { low: 7_000, normal: 10_000, high: 18_000 };

/** How many confirmations each priority waits for, relative to the chain default. */
const PRIORITY_CONFIRMATION_BPS: Record<FeePriority, number> = { low: 15_000, normal: 10_000, high: 5_000 };

const BLOCK_REWARD = new Map<string, Fixed>(
  Object.entries(MINING.blockReward).map(([chain, amount]) => [chain, parseDecimal(amount)]),
);

/**
 * A chain that has been silent for longer than this many block times has almost
 * certainly been down rather than slow. Replaying the whole gap would mint
 * thousands of Solana blocks in a burst; the chain restarts from now instead.
 */
const MAX_CATCH_UP_BLOCKS = 2;

const PENDING_STATUSES = ['pending', 'confirming'] as const;

interface ChainHead {
  height: number;
  lastBlockAt: number;
}

interface Settlement {
  row: typeof chainTransactions.$inferSelect;
  sender: { kind: 'user' | 'company'; id: number } | null;
  recipient: { kind: 'user' | 'company'; id: number } | null;
}

/**
 * The simulated chains.
 *
 * Each chain produces blocks at its own cadence, and a transfer is only spendable
 * once its chain has produced enough of them. That wait is the entire point of
 * the feature: a wallet transfer is not an instant balance edit the way a spot
 * trade is, so Solana genuinely feels different from Bitcoin, and a player who
 * wants their coins now pays for a higher priority instead of getting it free.
 */
export class ChainSimulator implements EngineModule {
  readonly name = 'chains';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;

  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private readonly heads = new Map<ChainSymbol, ChainHead>();

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
  }

  async start(): Promise<void> {
    if (this.timer) return;
    for (const chain of CHAIN_SYMBOLS) await this.resync(chain);
    this.timer = setInterval(() => void this.tick(), WALLET.blockTickMs);
    this.ctx.log.info(
      { chains: [...this.heads].map(([chain, head]) => `${chain}@${head.height}`) },
      'chain simulator started',
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Current tip of a chain, for the wallet routes and block explorers. */
  height(chain: ChainSymbol): number {
    return this.heads.get(chain)?.height ?? 0;
  }

  // -------------------------------------------------------------------------
  // Block production
  // -------------------------------------------------------------------------

  /**
   * Adopt the durable tip. Genesis rows are seeded by the migration, so a restart
   * continues the existing chain; forking it would orphan every confirmation
   * count already handed out to a player.
   */
  private async resync(chain: ChainSymbol): Promise<void> {
    try {
      const [row] = await this.ctx.db
        .select({ height: chainBlocks.height, minedAt: chainBlocks.minedAt })
        .from(chainBlocks)
        .where(eq(chainBlocks.chain, chain))
        .orderBy(desc(chainBlocks.height))
        .limit(1);
      this.heads.set(chain, {
        height: row?.height ?? 0,
        lastBlockAt: row?.minedAt.getTime() ?? Date.now(),
      });
    } catch (error) {
      this.ctx.log.error({ err: error, chain }, 'failed to read chain head');
      if (!this.heads.has(chain)) this.heads.set(chain, { height: 0, lastBlockAt: Date.now() });
    }
  }

  private async tick(): Promise<void> {
    // Confirmation settlement can outlive a one-second tick on a busy chain;
    // overlapping passes would advance the same transaction twice.
    if (this.ticking) return;
    this.ticking = true;
    try {
      const at = Date.now();
      for (const chain of CHAIN_SYMBOLS) {
        const head = this.heads.get(chain);
        if (!head) continue;
        const blockTimeMs = CHAINS[chain].blockTimeSeconds * 1_000;
        if (at - head.lastBlockAt < blockTimeMs) continue;

        head.lastBlockAt =
          at - head.lastBlockAt > blockTimeMs * MAX_CATCH_UP_BLOCKS ? at : head.lastBlockAt + blockTimeMs;

        try {
          await this.produceBlock(chain, at);
        } catch (error) {
          this.ctx.log.error({ err: error, chain }, 'block production failed');
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async produceBlock(chain: ChainSymbol, at: number): Promise<void> {
    const head = this.heads.get(chain);
    if (!head) return;
    const height = head.height + 1;

    // The pool owns the hashrate figure; the block only records what the network
    // looked like when it was found.
    const hashrate = activeMiningPool()?.networkHashrate(chain) ?? MINING.baselineHashrate;

    const inserted = await this.ctx.db
      .insert(chainBlocks)
      .values({
        chain,
        height,
        hash: generateBlockHash(chain, height),
        networkHashrate: hashrate,
        reward: BLOCK_REWARD.get(chain) ?? ZERO,
        minedAt: new Date(at),
      })
      .onConflictDoNothing({ target: [chainBlocks.chain, chainBlocks.height] })
      .returning({ height: chainBlocks.height });

    if (inserted.length === 0) {
      // Somebody else already claimed this height. Adopt the durable tip rather
      // than looping on a height that will never insert.
      await this.resync(chain);
      return;
    }

    head.height = height;
    this.ctx.bus.emit('block', { chain, height, at });
    await this.advanceConfirmations(chain, height, at);
  }

  // -------------------------------------------------------------------------
  // Confirmations & settlement
  // -------------------------------------------------------------------------

  /**
   * Give every in-flight transfer on the chain one more confirmation, and settle
   * the ones that reach their threshold. One statement and one transaction for
   * the whole chain: at a Solana block per second, a query per transfer would
   * dominate the engine's database time.
   */
  private async advanceConfirmations(chain: ChainSymbol, height: number, at: number): Promise<void> {
    const reached = sql`${chainTransactions.confirmations} + 1 >= ${chainTransactions.requiredConfirmations}`;

    const settled = await this.ctx.db.transaction(async (tx) => {
      const advanced = await tx
        .update(chainTransactions)
        .set({
          confirmations: sql`${chainTransactions.confirmations} + 1`,
          status: sql`case when ${reached} then 'confirmed' else 'confirming' end`,
          confirmedAt: sql`case when ${reached} then now() else ${chainTransactions.confirmedAt} end`,
          // The height a transfer was first seen at, not the one that confirmed
          // it — that is what a block explorer means by "included in block".
          blockHeight: sql`coalesce(${chainTransactions.blockHeight}, ${height})`,
        })
        .where(and(eq(chainTransactions.chain, chain), inArray(chainTransactions.status, [...PENDING_STATUSES])))
        .returning();

      const results: Settlement[] = [];
      for (const row of advanced) {
        if (row.status !== 'confirmed') continue;
        results.push(await this.settle(tx, row));
      }
      return results;
    });

    for (const settlement of settled) await this.announce(settlement, at);
  }

  /**
   * Move a confirmed transfer's value into its final resting place: out of the
   * recipient's pending balance into their spendable one, and off the sender's
   * lock. Both sides are clamped at zero so a double settlement — which the
   * status filter already prevents — could still never mint a negative balance.
   */
  private async settle(tx: Transaction, row: typeof chainTransactions.$inferSelect): Promise<Settlement> {
    const amount = row.amount.toString();
    // The sender's lock covers the fee too: it left their balance when the
    // transfer was submitted.
    const locked = (row.amount + row.fee).toString();

    let recipient: Settlement['recipient'] = null;
    if (row.toWalletId !== null) {
      const [wallet] = await tx
        .select({ id: wallets.id, ownerKind: wallets.ownerKind, ownerId: wallets.ownerId })
        .from(wallets)
        .where(eq(wallets.id, row.toWalletId))
        .for('update');
      if (wallet) {
        await tx
          .update(wallets)
          .set({
            balance: sql`${wallets.balance} + ${amount}::numeric`,
            pendingBalance: sql`greatest(0::numeric, ${wallets.pendingBalance} - ${amount}::numeric)`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
        recipient = { kind: wallet.ownerKind, id: wallet.ownerId };
      }
    }

    let sender: Settlement['sender'] = null;
    if (row.fromWalletId !== null) {
      const [wallet] = await tx
        .select({ id: wallets.id, ownerKind: wallets.ownerKind, ownerId: wallets.ownerId })
        .from(wallets)
        .where(eq(wallets.id, row.fromWalletId))
        .for('update');
      if (wallet) {
        await tx
          .update(wallets)
          .set({
            lockedBalance: sql`greatest(0::numeric, ${wallets.lockedBalance} - ${locked}::numeric)`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, wallet.id));
        sender = { kind: wallet.ownerKind, id: wallet.ownerId };
      }
    }

    return { row, sender, recipient };
  }

  /**
   * Tell both sides their transfer landed. Deliberately after the commit: a
   * pushed notification for a rolled-back credit cannot be taken back.
   */
  private async announce(settlement: Settlement, at: number): Promise<void> {
    const { row, sender, recipient } = settlement;
    try {
      const senderUserId = sender ? await resolveNotifyTarget(this.ctx.db, sender.kind, sender.id) : null;
      const recipientUserId = recipient
        ? await resolveNotifyTarget(this.ctx.db, recipient.kind, recipient.id)
        : null;

      if (senderUserId !== null) {
        this.ctx.bus.emit('chainTx', { userId: senderUserId, tx: toWire(row, 'out', at) });
      }
      if (recipientUserId !== null && recipientUserId !== senderUserId) {
        this.ctx.bus.emit('chainTx', { userId: recipientUserId, tx: toWire(row, 'in', at) });
        await notify(this.ctx.db, {
          userId: recipientUserId,
          kind: 'transfer_received',
          title: 'Transfert reçu',
          body: `${toDecimalString(row.amount)} ${row.chain} ont été crédités sur votre portefeuille.`,
          href: '/wallets',
        });
      }
    } catch (error) {
      // The value has already moved; failing to announce it must not retry the
      // settlement, only lose the toast.
      this.ctx.log.error({ err: error, txId: row.id }, 'failed to announce confirmed transfer');
    }
  }
}

function toWire(
  row: typeof chainTransactions.$inferSelect,
  direction: 'in' | 'out',
  at: number,
): Record<string, unknown> {
  return {
    id: row.id,
    hash: row.hash,
    chain: row.chain,
    direction,
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    amount: row.amount.toString(),
    fee: row.fee.toString(),
    status: row.status,
    confirmations: row.confirmations,
    requiredConfirmations: row.requiredConfirmations,
    blockHeight: row.blockHeight,
    kind: row.kind,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? new Date(at).toISOString(),
  };
}

/**
 * What a transfer will cost on `chain` at `priority`.
 *
 * The jitter is what makes a fee an estimate rather than a tariff: two sends a
 * second apart do not cost the same, so the wallet has to quote the fee it
 * actually charged instead of letting the client recompute it. Every chain's
 * variance is well under 100%, so the result can never reach zero — and it is
 * floored at one unit anyway, because a free transaction would let a player
 * spam the mempool at no cost.
 */
export function estimateFee(chain: ChainSymbol, priority: FeePriority = 'normal'): Fixed {
  const spec = CHAINS[chain];
  const scaled = mulRatio(parseDecimal(spec.baseFee), BigInt(PRIORITY_FEE_BPS[priority]), 10_000n);
  const jitterBps = Math.round((random.next() * 2 - 1) * spec.feeVarianceBps);
  const fee = mulRatio(scaled, BigInt(10_000 + jitterBps), 10_000n);
  return fee > ZERO ? fee : 1n;
}

/** How many blocks a transfer at this priority waits for. Always at least one. */
export function confirmationsFor(chain: ChainSymbol, priority: FeePriority = 'normal'): number {
  const required = (CHAINS[chain].confirmationsRequired * PRIORITY_CONFIRMATION_BPS[priority]) / 10_000;
  return Math.max(1, Math.round(required));
}
