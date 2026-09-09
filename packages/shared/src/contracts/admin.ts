import { z } from 'zod';
import { zDecimalInput, zFixed, zId, zPagination } from './common.js';
import { zUserRole } from './auth.js';

export const zAdminStats = z.object({
  users: z.object({ total: z.number().int(), active24h: z.number().int(), new24h: z.number().int() }),
  economy: z.object({
    totalCash: zFixed,
    totalHoldingsValue: zFixed,
    totalNetWorth: zFixed,
    totalDebt: zFixed,
    moneySupply: zFixed,
  }),
  activity: z.object({
    trades24h: z.number().int(),
    volume24h: zFixed,
    openOrders: z.number().int(),
    companies: z.number().int(),
    listedCompanies: z.number().int(),
  }),
  engine: z.object({
    uptimeSeconds: z.number().int(),
    tickCount: z.number().int(),
    lastTickAt: z.string().nullable(),
    connectedSockets: z.number().int(),
  }),
});
export type AdminStats = z.infer<typeof zAdminStats>;

export const zAdminUserRow = z.object({
  id: zId,
  displayName: z.string(),
  email: z.string(),
  role: zUserRole,
  status: z.enum(['active', 'suspended', 'banned']),
  cash: zFixed,
  netWorth: zFixed,
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});

export const zAdminUserQuery = zPagination.extend({
  search: z.string().trim().max(64).optional(),
  role: zUserRole.optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
});

export const zAdjustCashInput = z.object({
  userId: zId,
  /** Signed decimal: "500" credits, "-500" debits. */
  amount: z.string().trim().regex(/^-?\d{1,18}(?:\.\d{1,8})?$/),
  reason: z.string().trim().min(3).max(200),
});

export const zSetRoleInput = z.object({ userId: zId, role: zUserRole });
export const zSetStatusInput = z.object({
  userId: zId,
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().trim().max(200).optional(),
});

export const zAdminAssetInput = z.object({
  ticker: z.string().trim().toUpperCase().max(12),
  name: z.string().trim().min(1).max(120),
  assetClass: z.string(),
  description: z.string().trim().max(1000),
  price: zDecimalInput,
  isTradable: z.boolean().default(true),
});

export const zAdminEventInput = z.object({
  ticker: z.string().trim().toUpperCase().max(12).nullable(),
  headline: z.string().trim().min(5).max(200),
  body: z.string().trim().min(10).max(2000),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  magnitude: z.enum(['minor', 'moderate', 'major', 'shock']),
});

export const zAuditLogEntry = z.object({
  id: zId,
  actorId: zId.nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.unknown(),
  ip: z.string().nullable(),
  createdAt: z.string(),
});

export const zAuditQuery = zPagination.extend({
  action: z.string().trim().max(64).optional(),
  actorId: zId.optional(),
});
