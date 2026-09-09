import { z } from 'zod';
import { LIMITS } from '../constants.js';
import { zDecimalInput, zFixed, zId, zPagination } from './common.js';

export const zPublicProfile = z.object({
  id: zId,
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarColor: z.string(),
  rank: z.number().int().nullable(),
  netWorth: zFixed.nullable(),
  totalPnlPct: zFixed.nullable(),
  tradeCount: z.number().int(),
  companies: z.array(z.object({ id: zId, name: z.string(), ticker: z.string(), role: z.string() })),
  achievements: z.array(z.object({ id: z.string(), name: z.string(), unlockedAt: z.string() })),
  /** The player chooses whether their net worth is public. */
  isPortfolioPublic: z.boolean(),
  joinedAt: z.string(),
});
export type PublicProfile = z.infer<typeof zPublicProfile>;

export const zUpdateProfileInput = z.object({
  displayName: z.string().trim().min(LIMITS.displayNameMin).max(LIMITS.displayNameMax).optional(),
  bio: z.string().trim().max(LIMITS.bioMax).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isPortfolioPublic: z.boolean().optional(),
});

export const zLeaderboardEntry = z.object({
  rank: z.number().int(),
  userId: zId,
  displayName: z.string(),
  avatarColor: z.string(),
  netWorth: zFixed,
  pnlPct: zFixed,
  change: z.number().int(),
  isViewer: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof zLeaderboardEntry>;

export const zLeaderboardQuery = zPagination.extend({
  metric: z.enum(['netWorth', 'pnlPct', 'dayPnl', 'tradeCount']).default('netWorth'),
  period: z.enum(['all', 'month', 'week', 'day']).default('all'),
});

export const zChatMessage = z.object({
  id: zId,
  room: z.string(),
  userId: zId.nullable(),
  displayName: z.string(),
  avatarColor: z.string(),
  body: z.string(),
  createdAt: z.string(),
  isSystem: z.boolean(),
});
export type ChatMessage = z.infer<typeof zChatMessage>;

export const zChatSendInput = z.object({
  room: z.string().trim().min(1).max(32),
  body: z.string().trim().min(1).max(LIMITS.chatMessageMax),
});

export const NOTIFICATION_KINDS = [
  'order_filled', 'order_cancelled', 'price_alert', 'transfer_received', 'dividend_received',
  'company_invite', 'company_role', 'market_settled', 'bet_won', 'bet_lost', 'mining_reward',
  'loan_due', 'loan_liquidated', 'achievement', 'system', 'ipo',
] as const;
export const zNotificationKind = z.enum(NOTIFICATION_KINDS);

export const zNotification = z.object({
  id: zId,
  kind: zNotificationKind,
  title: z.string(),
  body: z.string(),
  href: z.string().nullable(),
  isRead: z.boolean(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof zNotification>;

export const zNotificationQuery = zPagination.extend({ unreadOnly: z.coerce.boolean().default(false) });

/** Peer-to-peer OTC offer: escrowed, so neither side can rug the other. */
export const zOtcOfferInput = z.object({
  /** What the maker gives. */
  offerTicker: z.string().trim().toUpperCase().max(12),
  offerQuantity: zDecimalInput,
  /** What the maker wants, in cash or in another asset. */
  wantTicker: z.string().trim().toUpperCase().max(12).nullable(),
  wantQuantity: zDecimalInput.optional(),
  wantCash: zDecimalInput.optional(),
  /** Restrict the offer to a single counterparty. */
  targetUserId: zId.optional(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});
export type OtcOfferInput = z.infer<typeof zOtcOfferInput>;

export const zOtcOffer = z.object({
  id: zId,
  makerId: zId,
  makerName: z.string(),
  offerTicker: z.string(),
  offerQuantity: zFixed,
  wantTicker: z.string().nullable(),
  wantQuantity: zFixed.nullable(),
  wantCash: zFixed.nullable(),
  targetUserId: zId.nullable(),
  status: z.enum(['open', 'accepted', 'cancelled', 'expired']),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type OtcOffer = z.infer<typeof zOtcOffer>;

export const zSearchQuery = z.object({ q: z.string().trim().min(1).max(64) });

export const zSearchResults = z.object({
  assets: z.array(z.object({ ticker: z.string(), name: z.string(), assetClass: z.string(), price: zFixed })),
  companies: z.array(z.object({ id: zId, name: z.string(), ticker: z.string() })),
  users: z.array(z.object({ id: zId, displayName: z.string(), avatarColor: z.string() })),
});
