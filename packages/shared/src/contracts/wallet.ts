import { z } from 'zod';
import { CHAIN_SYMBOLS } from '../constants.js';
import { zDecimalInput, zFixed, zId, zPagination } from './common.js';

export const zChainSymbol = z.enum(CHAIN_SYMBOLS as [string, ...string[]]);

export const zWallet = z.object({
  id: zId,
  chain: zChainSymbol,
  address: z.string(),
  label: z.string(),
  /** Confirmed, spendable balance. */
  balance: zFixed,
  /** Incoming funds still waiting for confirmations. */
  pendingBalance: zFixed,
  stakedBalance: zFixed,
  fiatValue: zFixed,
  isPrimary: z.boolean(),
  createdAt: z.string(),
});
export type Wallet = z.infer<typeof zWallet>;

export const zWalletSummary = z.object({
  wallets: z.array(zWallet),
  totalFiatValue: zFixed,
  totalStakedFiatValue: zFixed,
});

export const CHAIN_TX_STATUSES = ['pending', 'confirming', 'confirmed', 'failed'] as const;
export const zChainTxStatus = z.enum(CHAIN_TX_STATUSES);

export const zChainTransaction = z.object({
  id: zId,
  hash: z.string(),
  chain: zChainSymbol,
  direction: z.enum(['in', 'out', 'self']),
  fromAddress: z.string(),
  toAddress: z.string(),
  amount: zFixed,
  fee: zFixed,
  status: zChainTxStatus,
  confirmations: z.number().int(),
  requiredConfirmations: z.number().int(),
  blockHeight: z.number().int().nullable(),
  memo: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
});
export type ChainTransaction = z.infer<typeof zChainTransaction>;

/** Send coins to another player's address (or an external burn address). */
export const zSendInput = z.object({
  chain: zChainSymbol,
  toAddress: z.string().trim().min(6).max(80),
  amount: zDecimalInput,
  memo: z.string().trim().max(140).optional(),
  /** Higher priority pays a larger fee and confirms sooner. */
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type SendInput = z.infer<typeof zSendInput>;

/** Move coins between the exchange spot balance and the on-chain wallet. */
export const zWalletTransferInput = z.object({
  chain: zChainSymbol,
  direction: z.enum(['deposit', 'withdraw']),
  amount: zDecimalInput,
});

export const zSwapInput = z.object({
  fromChain: zChainSymbol,
  toChain: zChainSymbol,
  amount: zDecimalInput,
  /** Maximum tolerated slippage in percent. */
  maxSlippagePercent: zDecimalInput.default('1'),
});

export const zSwapQuote = z.object({
  fromChain: zChainSymbol,
  toChain: zChainSymbol,
  amountIn: zFixed,
  amountOut: zFixed,
  rate: zFixed,
  feeAmount: zFixed,
  priceImpactPct: zFixed,
  expiresAt: z.number().int(),
});

export const zStakeInput = z.object({
  chain: zChainSymbol,
  amount: zDecimalInput,
  durationHours: z.number().int().min(24).max(24 * 365),
});

export const zStakePosition = z.object({
  id: zId,
  chain: zChainSymbol,
  amount: zFixed,
  apyBps: z.number().int(),
  rewardAccrued: zFixed,
  startedAt: z.string(),
  unlocksAt: z.string(),
  status: z.enum(['active', 'unstaked', 'unstaked_early']),
});
export type StakePosition = z.infer<typeof zStakePosition>;

export const zChainTxQuery = zPagination.extend({
  chain: zChainSymbol.optional(),
  status: zChainTxStatus.optional(),
});

export const zAddressBookEntry = z.object({
  id: zId,
  label: z.string(),
  chain: zChainSymbol,
  address: z.string(),
  createdAt: z.string(),
});

export const zAddressBookInput = z.object({
  label: z.string().trim().min(1).max(48),
  chain: zChainSymbol,
  address: z.string().trim().min(6).max(80),
});

// --- Mining -----------------------------------------------------------------

export const zRigPurchaseInput = z.object({
  rigId: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(100),
  /** Buy on behalf of a company instead of the player. */
  companyId: zId.optional(),
});

export const zOwnedRig = z.object({
  rigId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  hashrate: z.number(),
  powerWatts: z.number(),
  chain: z.string(),
  purchasePrice: zFixed,
});
export type OwnedRig = z.infer<typeof zOwnedRig>;

export const zMiningStatus = z.object({
  rigs: z.array(zOwnedRig),
  totalHashrate: z.number(),
  networkHashrate: z.number(),
  sharePpm: z.number(),
  estimatedDailyReward: zFixed,
  estimatedDailyCost: zFixed,
  estimatedDailyProfit: zFixed,
  unclaimed: z.record(z.string(), zFixed),
  powerDrawWatts: z.number(),
  lastBlockAt: z.string().nullable(),
});
export type MiningStatus = z.infer<typeof zMiningStatus>;
