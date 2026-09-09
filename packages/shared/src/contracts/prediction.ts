import { z } from 'zod';
import { PREDICTION } from '../constants.js';
import { zDecimalInput, zFixed, zId, zPagination } from './common.js';

export const zMarketStatus = z.enum(['open', 'closed', 'settled', 'cancelled']);

export const zCreateMarketInput = z.object({
  title: z.string().trim().min(10).max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(2).max(48),
  outcomes: z
    .array(z.string().trim().min(1).max(80))
    .min(PREDICTION.minOutcomes)
    .max(PREDICTION.maxOutcomes)
    .refine((list) => new Set(list.map((o) => o.toLowerCase())).size === list.length, 'Issues en double'),
  closingAt: z.string().datetime(),
});
export type CreateMarketInput = z.infer<typeof zCreateMarketInput>;

export const zMarketOutcome = z.object({
  id: zId,
  name: z.string(),
  pool: zFixed,
  /** Implied probability, fixed-point percent. */
  impliedPct: zFixed,
  /** Payout multiple if this outcome wins. */
  odds: zFixed,
  betCount: z.number().int(),
  isWinner: z.boolean(),
});
export type MarketOutcome = z.infer<typeof zMarketOutcome>;

export const zPredictionMarket = z.object({
  id: zId,
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  status: zMarketStatus,
  totalPool: zFixed,
  outcomes: z.array(zMarketOutcome),
  creatorId: zId.nullable(),
  creatorName: z.string(),
  closingAt: z.string(),
  settledAt: z.string().nullable(),
  createdAt: z.string(),
  viewerBets: z.array(
    z.object({ outcomeId: zId, amount: zFixed, status: z.string(), payout: zFixed }),
  ),
});
export type PredictionMarket = z.infer<typeof zPredictionMarket>;

export const zPlaceBetInput = z.object({
  outcomeId: zId,
  amount: zDecimalInput,
});

export const zSettleMarketInput = z.object({ winningOutcomeId: zId });

export const zMarketListQuery = zPagination.extend({
  status: zMarketStatus.optional(),
  category: z.string().trim().max(48).optional(),
  mineOnly: z.coerce.boolean().default(false),
  search: z.string().trim().max(64).optional(),
});
