import { z } from 'zod';
import { zDecimalInput, zFixed, zId, zPagination, zTicker } from './common.js';
import { zAssetClass, zOrderSide } from './market.js';

export const zHolding = z.object({
  ticker: z.string(),
  name: z.string(),
  assetClass: zAssetClass,
  quantity: zFixed,
  /** Quantity locked by resting sell orders — cannot be sold twice. */
  lockedQuantity: zFixed,
  averageCost: zFixed,
  price: zFixed,
  marketValue: zFixed,
  unrealizedPnl: zFixed,
  unrealizedPnlPct: zFixed,
  realizedPnl: zFixed,
  /** Share of the portfolio, in fixed-point percent. */
  weightPct: zFixed,
});
export type Holding = z.infer<typeof zHolding>;

export const zPortfolioSummary = z.object({
  cash: zFixed,
  /** Cash reserved by resting buy orders. */
  lockedCash: zFixed,
  availableCash: zFixed,
  holdingsValue: zFixed,
  walletValue: zFixed,
  companyValue: zFixed,
  stakedValue: zFixed,
  debt: zFixed,
  netWorth: zFixed,
  initialCash: zFixed,
  totalPnl: zFixed,
  totalPnlPct: zFixed,
  dayPnl: zFixed,
  dayPnlPct: zFixed,
  realizedPnl: zFixed,
  updatedAt: z.string(),
});
export type PortfolioSummary = z.infer<typeof zPortfolioSummary>;

export const zPortfolio = z.object({
  summary: zPortfolioSummary,
  holdings: z.array(zHolding),
  allocation: z.array(z.object({ label: z.string(), value: zFixed, pct: zFixed })),
});
export type Portfolio = z.infer<typeof zPortfolio>;

export const zNetWorthPoint = z.object({ t: z.number().int(), value: zFixed });
export type NetWorthPoint = z.infer<typeof zNetWorthPoint>;

export const LEDGER_KINDS = [
  'trade_buy', 'trade_sell', 'fee', 'dividend', 'interest', 'loan', 'loan_repay',
  'mining_reward', 'staking_reward', 'transfer_in', 'transfer_out', 'bet', 'bet_payout',
  'company_deposit', 'company_withdrawal', 'ipo_proceeds', 'share_purchase', 'share_sale',
  'signup_bonus', 'daily_bonus', 'achievement', 'admin_adjustment', 'swap', 'rig_purchase',
  'rig_sale', 'electricity', 'company_creation', 'market_creation', 'refund',
] as const;
export const zLedgerKind = z.enum(LEDGER_KINDS);
export type LedgerKind = z.infer<typeof zLedgerKind>;

export const zLedgerEntry = z.object({
  id: zId,
  kind: zLedgerKind,
  /** Signed: positive credits the account, negative debits it. */
  amount: zFixed,
  balanceAfter: zFixed,
  ticker: z.string().nullable(),
  quantity: zFixed.nullable(),
  price: zFixed.nullable(),
  description: z.string(),
  counterpartyId: zId.nullable(),
  counterpartyName: z.string().nullable(),
  createdAt: z.string(),
});
export type LedgerEntry = z.infer<typeof zLedgerEntry>;

export const zLedgerQuery = zPagination.extend({
  kind: zLedgerKind.optional(),
  ticker: zTicker.optional(),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

export const zTransactionRow = z.object({
  id: zId,
  ticker: z.string(),
  name: z.string(),
  side: zOrderSide,
  quantity: zFixed,
  price: zFixed,
  value: zFixed,
  fee: zFixed,
  realizedPnl: zFixed.nullable(),
  createdAt: z.string(),
});
export type TransactionRow = z.infer<typeof zTransactionRow>;

export const zWatchlistInput = z.object({ ticker: zTicker });

export const zLoanInput = z.object({
  amount: zDecimalInput,
  termDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

export const zLoan = z.object({
  id: zId,
  principal: zFixed,
  outstanding: zFixed,
  interestAccrued: zFixed,
  aprBps: z.number().int(),
  termDays: z.number().int(),
  status: z.enum(['active', 'repaid', 'defaulted']),
  dueAt: z.string(),
  createdAt: z.string(),
});
export type Loan = z.infer<typeof zLoan>;
