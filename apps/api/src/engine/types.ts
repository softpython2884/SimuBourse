import type { Fixed } from '@alvora/shared';
import type { Database } from '@alvora/db';
import type { EngineBus } from './bus.js';
import type { FastifyBaseLogger } from 'fastify';

/** Everything an engine module is handed at construction. */
export interface EngineContext {
  db: Database;
  bus: EngineBus;
  log: FastifyBaseLogger;
}

/** Live, in-memory view of one instrument. The database is the durable copy. */
export interface AssetState {
  ticker: string;
  name: string;
  assetClass: string;
  price: Fixed;
  anchorPrice: Fixed;
  previousClose: Fixed;
  high24h: Fixed;
  low24h: Fixed;
  volume24h: Fixed;
  circulatingSupply: Fixed | null;
  sigmaBps: number;
  driftBps: number;
  isTradable: boolean;
  hasOrderBook: boolean;
  companyId: number | null;
  chain: string | null;
  /** Net signed volume since the last tick, driving order-flow price impact. */
  flowSinceTick: Fixed;
  /** Sum of live event pressure in bps, decaying over each event's lifetime. */
  eventPressureBps: number;
  /** Recent prices for the sparkline, oldest first. */
  recent: Fixed[];
  dirty: boolean;
}

/** A resting order as the in-memory book sees it. */
export interface BookOrder {
  id: number;
  ticker: string;
  ownerKind: 'user' | 'company';
  ownerId: number;
  userId: number;
  side: 'buy' | 'sell';
  price: Fixed;
  /** Quantity still open. */
  remaining: Fixed;
  createdAt: number;
  sequence: number;
}

export interface MatchResult {
  price: Fixed;
  quantity: Fixed;
  restingOrder: BookOrder;
}

/** Contract every long-running engine module implements. */
export interface EngineModule {
  readonly name: string;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}
