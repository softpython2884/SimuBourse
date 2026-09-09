import { z } from 'zod';
import { ASSET_CLASSES } from '../constants.js';
import { zDecimalInput, zFixed, zId, zPagination, zTicker } from './common.js';

export const zAssetClass = z.enum(ASSET_CLASSES as [string, ...string[]]);

export const zAsset = z.object({
  ticker: z.string(),
  name: z.string(),
  assetClass: zAssetClass,
  description: z.string(),
  price: zFixed,
  previousClose: zFixed,
  change24h: zFixed,
  changePct24h: zFixed,
  high24h: zFixed,
  low24h: zFixed,
  volume24h: zFixed,
  marketCap: zFixed.nullable(),
  circulatingSupply: zFixed.nullable(),
  /** Present only for player-founded companies listed on the exchange. */
  companyId: zId.nullable(),
  chain: z.string().nullable(),
  isTradable: z.boolean(),
  logoSeed: z.string(),
});
export type Asset = z.infer<typeof zAsset>;

export const zPriceTick = z.object({
  ticker: z.string(),
  price: zFixed,
  changePct24h: zFixed,
  volume24h: zFixed,
  at: z.number().int(),
});
export type PriceTick = z.infer<typeof zPriceTick>;

export const CANDLE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export const zCandleInterval = z.enum(CANDLE_INTERVALS);
export type CandleInterval = z.infer<typeof zCandleInterval>;

export const zCandle = z.object({
  /** Bucket start, unix ms. */
  t: z.number().int(),
  o: zFixed,
  h: zFixed,
  l: zFixed,
  c: zFixed,
  v: zFixed,
});
export type Candle = z.infer<typeof zCandle>;

export const zCandleQuery = z.object({
  interval: zCandleInterval.default('5m'),
  limit: z.coerce.number().int().min(1).max(1500).default(300),
  before: z.coerce.number().int().optional(),
});

export const ORDER_SIDES = ['buy', 'sell'] as const;
export const ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'] as const;
export const ORDER_STATUSES = ['open', 'partial', 'filled', 'cancelled', 'rejected', 'expired'] as const;
export const TIME_IN_FORCE = ['gtc', 'ioc', 'fok', 'day'] as const;

export const zOrderSide = z.enum(ORDER_SIDES);
export const zOrderType = z.enum(ORDER_TYPES);
export const zOrderStatus = z.enum(ORDER_STATUSES);
export const zTimeInForce = z.enum(TIME_IN_FORCE);

export type OrderSide = z.infer<typeof zOrderSide>;
export type OrderType = z.infer<typeof zOrderType>;
export type OrderStatus = z.infer<typeof zOrderStatus>;
export type TimeInForce = z.infer<typeof zTimeInForce>;

export const zPlaceOrderInput = z
  .object({
    ticker: zTicker,
    side: zOrderSide,
    type: zOrderType,
    /** Quantity in whole asset units. Exactly one of quantity/notional is required. */
    quantity: zDecimalInput.optional(),
    /** Spend this much cash instead of naming a quantity (buy only). */
    notional: zDecimalInput.optional(),
    limitPrice: zDecimalInput.optional(),
    stopPrice: zDecimalInput.optional(),
    /** Trailing distance in percent, for trailing_stop orders. */
    trailPercent: zDecimalInput.optional(),
    timeInForce: zTimeInForce.default('gtc'),
    /** Trade on behalf of a company the user has `trade:execute` on. */
    companyId: zId.optional(),
    /** Client-supplied idempotency key; a repeat returns the original order. */
    clientOrderId: z.string().min(8).max(64).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.quantity && !v.notional) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantité ou montant requis', path: ['quantity'] });
    }
    if (v.quantity && v.notional) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choisissez une quantité OU un montant', path: ['notional'] });
    }
    if (v.notional && v.side === 'sell') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Les ventes doivent indiquer une quantité', path: ['notional'] });
    }
    if ((v.type === 'limit' || v.type === 'stop_limit') && !v.limitPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Prix limite requis', path: ['limitPrice'] });
    }
    if ((v.type === 'stop' || v.type === 'stop_limit') && !v.stopPrice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Prix de déclenchement requis', path: ['stopPrice'] });
    }
    if (v.type === 'trailing_stop' && !v.trailPercent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Distance de suivi requise', path: ['trailPercent'] });
    }
  });
export type PlaceOrderInput = z.infer<typeof zPlaceOrderInput>;

export const zOrder = z.object({
  id: zId,
  ticker: z.string(),
  assetName: z.string(),
  side: zOrderSide,
  type: zOrderType,
  status: zOrderStatus,
  timeInForce: zTimeInForce,
  quantity: zFixed,
  filledQuantity: zFixed,
  limitPrice: zFixed.nullable(),
  stopPrice: zFixed.nullable(),
  trailPercent: zFixed.nullable(),
  averagePrice: zFixed,
  feePaid: zFixed,
  companyId: zId.nullable(),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Order = z.infer<typeof zOrder>;

export const zTrade = z.object({
  id: zId,
  ticker: z.string(),
  price: zFixed,
  quantity: zFixed,
  side: zOrderSide,
  at: z.number().int(),
});
export type Trade = z.infer<typeof zTrade>;

export const zBookLevel = z.object({ price: zFixed, quantity: zFixed, orders: z.number().int() });
export type BookLevel = z.infer<typeof zBookLevel>;

export const zOrderBook = z.object({
  ticker: z.string(),
  bids: z.array(zBookLevel),
  asks: z.array(zBookLevel),
  spread: zFixed,
  at: z.number().int(),
});
export type OrderBook = z.infer<typeof zOrderBook>;

export const zMarketEvent = z.object({
  id: zId,
  ticker: z.string().nullable(),
  headline: z.string(),
  body: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  magnitude: z.enum(['minor', 'moderate', 'major', 'shock']),
  impactBps: z.number().int(),
  source: z.enum(['engine', 'ai', 'admin', 'company']),
  createdAt: z.string(),
});
export type MarketEvent = z.infer<typeof zMarketEvent>;

export const zAssetListQuery = zPagination.extend({
  assetClass: zAssetClass.optional(),
  search: z.string().trim().max(64).optional(),
  sortBy: z.enum(['ticker', 'name', 'price', 'changePct24h', 'volume24h', 'marketCap']).default('marketCap'),
  order: z.enum(['asc', 'desc']).default('desc'),
  watchlistOnly: z.coerce.boolean().default(false),
});

export const zPriceAlertInput = z.object({
  ticker: zTicker,
  direction: z.enum(['above', 'below']),
  price: zDecimalInput,
});
