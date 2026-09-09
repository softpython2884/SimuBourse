import { z } from 'zod';
import { COMPANY, COMPANY_ROLES, INDUSTRIES } from '../constants.js';
import { zDecimalInput, zFixed, zId, zPagination } from './common.js';

export const zIndustryId = z.enum(INDUSTRIES.map((i) => i.id) as [string, ...string[]]);
export const zCompanyRole = z.enum(COMPANY_ROLES);

export const zCompanyTicker = z
  .string()
  .trim()
  .toUpperCase()
  .min(COMPANY.tickerMinLength)
  .max(COMPANY.tickerMaxLength)
  .regex(/^[A-Z]+$/, 'Le ticker ne peut contenir que des lettres');

export const zCreateCompanyInput = z.object({
  name: z.string().trim().min(3).max(64),
  ticker: zCompanyTicker,
  industry: zIndustryId,
  description: z.string().trim().min(20).max(1000),
  /** Cash injected from the founder's account on top of the creation fee. */
  initialFunding: zDecimalInput.optional(),
});
export type CreateCompanyInput = z.infer<typeof zCreateCompanyInput>;

export const zUpdateCompanyInput = z.object({
  description: z.string().trim().min(20).max(1000).optional(),
  industry: zIndustryId.optional(),
  logoColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const zCompanySummary = z.object({
  id: zId,
  name: z.string(),
  ticker: z.string(),
  industry: zIndustryId,
  isListed: z.boolean(),
  sharePrice: zFixed,
  totalShares: zFixed,
  floatShares: zFixed,
  marketCap: zFixed,
  treasury: zFixed,
  bookValue: zFixed,
  memberCount: z.number().int(),
  changePct24h: zFixed,
  logoColor: z.string(),
  founderName: z.string(),
  createdAt: z.string(),
});
export type CompanySummary = z.infer<typeof zCompanySummary>;

export const zCompanyMember = z.object({
  userId: zId,
  displayName: z.string(),
  role: zCompanyRole,
  shares: zFixed,
  sharePct: zFixed,
  salary: zFixed,
  joinedAt: z.string(),
});
export type CompanyMember = z.infer<typeof zCompanyMember>;

export const zCompanyDetail = zCompanySummary.extend({
  description: z.string(),
  members: z.array(zCompanyMember),
  holdings: z.array(
    z.object({
      ticker: z.string(),
      name: z.string(),
      quantity: zFixed,
      averageCost: zFixed,
      price: zFixed,
      marketValue: zFixed,
      unrealizedPnl: zFixed,
    }),
  ),
  shareholders: z.array(
    z.object({ userId: zId.nullable(), displayName: z.string(), quantity: zFixed, pct: zFixed }),
  ),
  financials: z.object({
    revenue30d: zFixed,
    expenses30d: zFixed,
    profit30d: zFixed,
    dividendsPaid: zFixed,
    treasury: zFixed,
    holdingsValue: zFixed,
    miningRevenue30d: zFixed,
  }),
  viewerRole: zCompanyRole.nullable(),
  viewerPermissions: z.array(z.string()),
  viewerShares: zFixed,
});
export type CompanyDetail = z.infer<typeof zCompanyDetail>;

export const zTreasuryInput = z.object({ amount: zDecimalInput });

export const zIpoInput = z.object({
  /** Share of total shares offered to the market, in percent. */
  floatPercent: zDecimalInput,
  /** Opening price per share. */
  pricePerShare: zDecimalInput,
});
export type IpoInput = z.infer<typeof zIpoInput>;

export const zIssueSharesInput = z.object({
  quantity: zDecimalInput,
  pricePerShare: zDecimalInput,
});

export const zBuybackInput = z.object({ quantity: zDecimalInput, maxPricePerShare: zDecimalInput });

export const zDividendInput = z.object({ totalAmount: zDecimalInput });

export const zMemberRoleInput = z.object({ userId: zId, role: zCompanyRole });
export const zMemberInviteInput = z.object({ displayName: z.string().trim().min(1).max(32), role: zCompanyRole });
export const zSalaryInput = z.object({ userId: zId, salary: zDecimalInput });

export const zCompanyListQuery = zPagination.extend({
  industry: zIndustryId.optional(),
  listedOnly: z.coerce.boolean().default(false),
  mineOnly: z.coerce.boolean().default(false),
  search: z.string().trim().max(64).optional(),
  sortBy: z.enum(['marketCap', 'treasury', 'createdAt', 'changePct24h', 'name']).default('marketCap'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const zCompanyEvent = z.object({
  id: zId,
  companyId: zId,
  kind: z.string(),
  description: z.string(),
  amount: zFixed.nullable(),
  actorName: z.string().nullable(),
  createdAt: z.string(),
});
