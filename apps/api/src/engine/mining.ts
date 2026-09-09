import { and, eq, sql } from 'drizzle-orm';
import {
  AppError,
  CHAIN_SYMBOLS,
  MINING,
  MINING_RIGS,
  ZERO,
  mulRatio,
  parseDecimal,
  toDecimalString,
  type ChainSymbol,
  type Fixed,
} from '@alvora/shared';
import {
  chainBlocks,
  chainTransactions,
  companies,
  companyMembers,
  miningRewards,
  miningRigs,
  wallets,
  type Database,
  type Transaction,
} from '@alvora/db';
import { debit, type Owner, type OwnerKind } from '../services/accounts.js';
import { ensureWallet, creditWallet } from '../services/wallets.js';
import { generateTxHash } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import type { EngineContext, EngineModule } from './types.js';
import type { Engine } from './index.js';

/** Where mined coins come from. Not a wallet, so `fromWalletId` stays null. */
export const COINBASE_ADDRESS = 'coinbase';

const RIG_BY_ID = new Map(MINING_RIGS.map((rig) => [rig.id as string, rig]));

const BLOCK_REWARD = new Map<string, Fixed>(
  Object.entries(MINING.blockReward).map(([chain, amount]) => [chain, parseDecimal(amount)]),
);

/** Electricity price per watt-hour, once, as an exact fixed-point value. */
const COST_PER_WH: Fixed = parseDecimal(MINING.electricityCostPerWh);

const MS_PER_HOUR = 3_600_000n;

/** Parts per million, the unit `mining_rewards.share_ppm` is denominated in. */
const PPM = 1_000_000n;

/**
 * Hashrates are catalogue integers today, but keeping three extra digits when
 * converting to bigint means a fractional rig rating would still divide exactly
 * instead of silently truncating somebody's share to zero.
 */
const HASHRATE_SCALE = 1_000;

/**
 * How often the cached network hashrate is recomputed.
 *
 * `networkHashrate()` is synchronous because the mining route needs it while
 * building a response, so it can only read a cached figure. A rig bought between
 * two refreshes is therefore invisible to the *estimate* shown in the UI for at
 * most this long; the actual payout always uses the hashrates read at the start
 * of the distribution cycle, so no reward is ever computed from stale data.
 */
const HASHRATE_REFRESH_MS = 15_000;

interface OwnerChainState {
  hashrate: number;
  watts: number;
  rigs: number;
}

interface OwnerState {
  kind: OwnerKind;
  id: number;
  /** Power drawn by every active rig, whatever chain it points at. */
  watts: number;
  chains: Map<string, OwnerChainState>;
}

interface ChainPayout {
  chain: string;
  reward: Fixed;
  hashrate: number;
  sharePpm: number;
  electricityCost: Fixed;
  blockHeight: number;
  walletId: number;
  address: string;
}

/**
 * The running pool, so modules that are handed the `Engine` but not its private
 * members can still reach it. There is exactly one engine per process; a second
 * one (a test harness) simply takes over the slot.
 */
let active: MiningPool | null = null;

/** The live mining pool, or null when the simulation is not running. */
export function activeMiningPool(): MiningPool | null {
  return active;
}

/**
 * Which player should hear about something that happened to an account.
 * A company has no inbox of its own, so its CEO — or, failing that, its founder —
 * receives the notification on its behalf.
 */
export async function resolveNotifyTarget(
  db: Database | Transaction,
  ownerKind: OwnerKind,
  ownerId: number,
): Promise<number | null> {
  if (ownerKind === 'user') return ownerId;

  const [ceo] = await db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .where(and(eq(companyMembers.companyId, ownerId), eq(companyMembers.role, 'ceo')))
    .limit(1);
  if (ceo) return ceo.userId;

  const [company] = await db
    .select({ founderId: companies.founderId })
    .from(companies)
    .where(eq(companies.id, ownerId))
    .limit(1);
  return company?.founderId ?? null;
}

/**
 * Proof-of-work mining.
 *
 * Every cycle mints one block reward per mineable chain and splits it strictly
 * pro rata by hashrate against `baselineHashrate + every rig in the world`. That
 * is the whole balance of the feature: a rig only earns by taking share from
 * everyone else, including its own buyer's other rigs, so returns fall as the
 * network grows. The legacy version paid a fixed amount per rig per tick, which
 * made mining a risk-free money printer that scaled linearly with spend.
 *
 * The counterweight is electricity: it is billed in cash for real elapsed time
 * whether or not the block paid, and an owner who cannot pay is taken offline.
 */
export class MiningPool implements EngineModule {
  readonly name = 'mining';

  private readonly ctx: EngineContext;
  private readonly engine: Engine;

  private blockTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private running = false;

  /** Cached network hashrate per chain, including the baseline. */
  private network = new Map<string, number>();
  /** Start of the period the next electricity bill covers. */
  private lastRunAt = Date.now();

  constructor(ctx: EngineContext, engine: Engine) {
    this.ctx = ctx;
    this.engine = engine;
    active = this;
  }

  async start(): Promise<void> {
    if (this.blockTimer) return;
    this.lastRunAt = Date.now();
    await this.refresh();
    this.blockTimer = setInterval(() => void this.runCycle(), MINING.blockIntervalMs);
    this.refreshTimer = setInterval(() => void this.refresh(), HASHRATE_REFRESH_MS);
    this.ctx.log.info({ intervalMs: MINING.blockIntervalMs }, 'mining pool started');
  }

  stop(): void {
    if (this.blockTimer) clearInterval(this.blockTimer);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.blockTimer = null;
    this.refreshTimer = null;
    if (active === this) active = null;
  }

  // -------------------------------------------------------------------------
  // Read models used by the mining route and by the chain simulator
  // -------------------------------------------------------------------------

  /** Total hashrate competing on a chain, baseline included. Never zero. */
  networkHashrate(chain: string): number {
    return this.network.get(chain) ?? MINING.baselineHashrate;
  }

  /** Live hashrate of one account on one chain, read straight from the database. */
  async ownerHashrate(ownerKind: OwnerKind, ownerId: number, chain: string): Promise<number> {
    const rows = await this.ctx.db
      .select({ rigId: miningRigs.rigId, quantity: miningRigs.quantity })
      .from(miningRigs)
      .where(
        and(
          eq(miningRigs.ownerKind, ownerKind),
          eq(miningRigs.ownerId, ownerId),
          eq(miningRigs.isActive, true),
        ),
      );

    let total = 0;
    for (const row of rows) {
      const rig = RIG_BY_ID.get(row.rigId);
      if (!rig || rig.chain !== chain || row.quantity <= 0) continue;
      total += rig.hashrate * row.quantity;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Distribution
  // -------------------------------------------------------------------------

  private async refresh(): Promise<void> {
    try {
      await this.loadOwners();
    } catch (error) {
      // Keep the previous snapshot: a stale hashrate is far better for the UI
      // than pretending the network is empty.
      this.ctx.log.error({ err: error }, 'failed to refresh network hashrate');
    }
  }

  private async runCycle(): Promise<void> {
    // A cycle that outlives its interval (slow database, many owners) must not
    // overlap itself: two concurrent passes would bill the same period twice.
    if (this.running) return;
    this.running = true;

    const at = Date.now();
    const elapsedMs = Math.max(0, at - this.lastRunAt);
    this.lastRunAt = at;

    try {
      const owners = await this.loadOwners();
      if (owners.size === 0) return;

      const heights = await this.blockHeights();

      for (const owner of owners.values()) {
        try {
          await this.payout(owner, elapsedMs, heights, at);
        } catch (error) {
          if (error instanceof AppError && error.code === 'INSUFFICIENT_FUNDS') {
            await this.suspend(owner);
          } else {
            // One broken account must not cost everybody else their block.
            this.ctx.log.error(
              { err: error, ownerKind: owner.kind, ownerId: owner.id },
              'mining payout failed',
            );
          }
        }
      }
    } catch (error) {
      this.ctx.log.error({ err: error }, 'mining cycle failed');
    } finally {
      this.running = false;
    }
  }

  /** Load every active rig, grouped by owner, refreshing the hashrate cache. */
  private async loadOwners(): Promise<Map<string, OwnerState>> {
    const rows = await this.ctx.db
      .select({
        ownerKind: miningRigs.ownerKind,
        ownerId: miningRigs.ownerId,
        rigId: miningRigs.rigId,
        quantity: miningRigs.quantity,
      })
      .from(miningRigs)
      .where(eq(miningRigs.isActive, true));

    const owners = new Map<string, OwnerState>();
    const network = new Map<string, number>();
    for (const chain of CHAIN_SYMBOLS) network.set(chain, MINING.baselineHashrate);

    for (const row of rows) {
      // An unknown rig id means the catalogue changed under an owned row; it
      // contributes nothing rather than crashing the whole distribution.
      const rig = RIG_BY_ID.get(row.rigId);
      if (!rig || row.quantity <= 0) continue;

      const hashrate = rig.hashrate * row.quantity;
      const watts = rig.powerWatts * row.quantity;

      const key = `${row.ownerKind}:${row.ownerId}`;
      let owner = owners.get(key);
      if (!owner) {
        owner = { kind: row.ownerKind, id: row.ownerId, watts: 0, chains: new Map() };
        owners.set(key, owner);
      }
      owner.watts += watts;

      const perChain = owner.chains.get(rig.chain) ?? { hashrate: 0, watts: 0, rigs: 0 };
      perChain.hashrate += hashrate;
      perChain.watts += watts;
      perChain.rigs += row.quantity;
      owner.chains.set(rig.chain, perChain);

      network.set(rig.chain, (network.get(rig.chain) ?? MINING.baselineHashrate) + hashrate);
    }

    this.network = network;
    return owners;
  }

  /** Current tip per chain, so a reward row points at the block that paid it. */
  private async blockHeights(): Promise<Map<string, number>> {
    const rows = await this.ctx.db
      .select({ chain: chainBlocks.chain, height: sql<string>`max(${chainBlocks.height})` })
      .from(chainBlocks)
      .groupBy(chainBlocks.chain);
    return new Map(rows.map((row) => [row.chain, Number(row.height ?? 0)]));
  }

  private async payout(
    owner: OwnerState,
    elapsedMs: number,
    heights: Map<string, number>,
    at: number,
  ): Promise<void> {
    const ownerRef: Owner = { kind: owner.kind, id: owner.id };
    const totalCost = electricityCost(owner.watts, elapsedMs);

    // Wallets are created outside the payout transaction: `ensureWallet` runs its
    // own insert, and a conflict on it must not roll back the electricity debit.
    const planned: Array<Omit<ChainPayout, 'walletId' | 'address'>> = [];
    for (const [chain, state] of owner.chains) {
      const blockReward = BLOCK_REWARD.get(chain);
      if (!blockReward || blockReward <= ZERO || state.hashrate <= 0) continue;

      const sharePpm = shareInPpm(state.hashrate, this.networkHashrate(chain));
      const reward = mulRatio(blockReward, BigInt(sharePpm), PPM);
      if (reward <= ZERO) continue;

      planned.push({
        chain,
        reward,
        hashrate: state.hashrate,
        sharePpm,
        electricityCost: electricityCost(state.watts, elapsedMs),
        blockHeight: heights.get(chain) ?? 0,
      });
    }

    if (planned.length === 0 && totalCost <= ZERO) return;

    const payouts: ChainPayout[] = [];
    for (const entry of planned) {
      await ensureWallet(this.ctx.db, ownerRef, entry.chain as ChainSymbol);
      const [wallet] = await this.ctx.db
        .select({ id: wallets.id, address: wallets.address })
        .from(wallets)
        .where(
          and(
            eq(wallets.ownerKind, owner.kind),
            eq(wallets.ownerId, owner.id),
            eq(wallets.chain, entry.chain),
          ),
        )
        .limit(1);
      if (!wallet) continue;
      payouts.push({ ...entry, walletId: wallet.id, address: wallet.address });
    }

    const confirmedAt = new Date(at);

    await this.ctx.db.transaction(async (tx) => {
      // Billed first: the electricity is owed for time already burnt, and a
      // player who cannot cover it must not be paid for the same period.
      if (totalCost > ZERO) {
        await debit(tx, ownerRef, totalCost, {
          kind: 'electricity',
          description: `Électricité de minage — ${owner.watts} W`,
        });
      }

      for (const payout of payouts) {
        await creditWallet(tx, payout.walletId, payout.reward);

        await tx.insert(miningRewards).values({
          ownerKind: owner.kind,
          ownerId: owner.id,
          chain: payout.chain,
          blockHeight: payout.blockHeight,
          hashrate: payout.hashrate,
          sharePpm: payout.sharePpm,
          reward: payout.reward,
          electricityCost: payout.electricityCost,
        });

        // Minted coins are credited outright, so the row is written already
        // confirmed and the chain simulator never tries to settle it again.
        await tx.insert(chainTransactions).values({
          hash: generateTxHash(),
          chain: payout.chain,
          fromAddress: COINBASE_ADDRESS,
          toAddress: payout.address,
          fromWalletId: null,
          toWalletId: payout.walletId,
          amount: payout.reward,
          fee: ZERO,
          status: 'confirmed',
          confirmations: 1,
          requiredConfirmations: 1,
          blockHeight: payout.blockHeight,
          kind: 'mining',
          memo: `Bloc #${payout.blockHeight}`,
          confirmedAt,
        });
      }
    });

    if (payouts.length > 0) await this.announce(owner, payouts, at);
  }

  /** One event stream update and at most one notification per owner per block. */
  private async announce(owner: OwnerState, payouts: ChainPayout[], at: number): Promise<void> {
    let userId: number | null = null;
    try {
      userId = await resolveNotifyTarget(this.ctx.db, owner.kind, owner.id);
    } catch (error) {
      this.ctx.log.error({ err: error, ownerId: owner.id }, 'failed to resolve mining recipient');
    }
    if (userId === null) return;

    for (const payout of payouts) {
      this.ctx.bus.emit('chainTx', {
        userId,
        tx: {
          chain: payout.chain,
          direction: 'in',
          fromAddress: COINBASE_ADDRESS,
          toAddress: payout.address,
          amount: payout.reward.toString(),
          fee: '0',
          status: 'confirmed',
          confirmations: 1,
          requiredConfirmations: 1,
          blockHeight: payout.blockHeight,
          kind: 'mining',
          at,
        },
      });
    }

    const body = payouts
      .map((payout) => `${toDecimalString(payout.reward)} ${payout.chain}`)
      .join(', ');
    try {
      await notify(this.ctx.db, {
        userId,
        kind: 'mining_reward',
        title: 'Récompense de minage',
        body: `Vos machines ont miné ${body}.`,
        href: '/mining',
      });
    } catch (error) {
      this.ctx.log.error({ err: error, userId }, 'failed to notify mining reward');
    }
  }

  /**
   * Take an owner's rigs offline because they could not pay for power.
   * Runs in its own transaction: the payout transaction has already rolled back.
   */
  private async suspend(owner: OwnerState): Promise<void> {
    try {
      await this.ctx.db
        .update(miningRigs)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(miningRigs.ownerKind, owner.kind),
            eq(miningRigs.ownerId, owner.id),
            eq(miningRigs.isActive, true),
          ),
        );

      const userId = await resolveNotifyTarget(this.ctx.db, owner.kind, owner.id);
      if (userId === null) return;
      await notify(this.ctx.db, {
        userId,
        kind: 'system',
        title: 'Minage interrompu',
        body:
          'Vos machines ont été mises hors ligne : la facture d’électricité n’a pas pu être réglée. ' +
          'Réapprovisionnez votre compte puis relancez-les.',
        href: '/mining',
      });
    } catch (error) {
      this.ctx.log.error({ err: error, ownerId: owner.id }, 'failed to suspend mining rigs');
    }
  }
}

/**
 * Share of the network, in parts per million.
 *
 * Integer division on scaled bigints rather than a float ratio: the result feeds
 * a `bigint` reward split, and a float share would round differently for two
 * miners with the same hashrate.
 */
function shareInPpm(ownerHashrate: number, networkHashrate: number): number {
  const owned = BigInt(Math.round(ownerHashrate * HASHRATE_SCALE));
  const total = BigInt(Math.round(networkHashrate * HASHRATE_SCALE));
  if (owned <= 0n || total <= 0n) return 0;
  const share = (owned * PPM) / total;
  return Number(share > PPM ? PPM : share);
}

/**
 * Cost of `watts` drawn for `elapsedMs`.
 *
 * Deliberately not rounded to cash: a 60-second slice of a small rig is worth a
 * fraction of a cent, and rounding it to two decimals would hand every miner
 * below ~1.7 kW free electricity forever.
 */
function electricityCost(watts: number, elapsedMs: number): Fixed {
  if (watts <= 0 || elapsedMs <= 0) return ZERO;
  const perHour = COST_PER_WH * BigInt(Math.round(watts));
  return mulRatio(perHour, BigInt(Math.round(elapsedMs)), MS_PER_HOUR);
}
