/**
 * Socket.IO event contract shared by the API gateway and the web client.
 *
 * The legacy app polled server actions and streamed prices over SSE with no
 * per-user channel, so fills and balance changes only appeared after a refresh.
 * Every mutation that a player can observe now has a typed event here.
 */
import type { Candle, MarketEvent, Order, OrderBook, PriceTick, Trade } from './contracts/market.js';
import type { ChatMessage, Notification } from './contracts/social.js';
import type { ChainTransaction } from './contracts/wallet.js';
import type { PortfolioSummary } from './contracts/portfolio.js';

/** Rooms a socket can join. Private rooms are enforced server-side from the JWT. */
export const ROOM = {
  prices: 'prices',
  asset: (ticker: string) => `asset:${ticker.toUpperCase()}`,
  book: (ticker: string) => `book:${ticker.toUpperCase()}`,
  user: (userId: number) => `user:${userId}`,
  company: (companyId: number) => `company:${companyId}`,
  chat: (room: string) => `chat:${room}`,
  leaderboard: 'leaderboard',
  events: 'events',
} as const;

/** Server → client. */
export interface ServerToClientEvents {
  'prices:tick': (payload: { ticks: PriceTick[]; at: number }) => void;
  'asset:candle': (payload: { ticker: string; interval: string; candle: Candle }) => void;
  'book:update': (payload: OrderBook) => void;
  'trade:new': (payload: Trade) => void;
  'event:new': (payload: MarketEvent) => void;

  'order:update': (payload: Order) => void;
  'order:fill': (payload: {
    orderId: number;
    ticker: string;
    side: 'buy' | 'sell';
    quantity: string;
    price: string;
    fee: string;
    isFinal: boolean;
  }) => void;

  'portfolio:update': (payload: PortfolioSummary) => void;
  'wallet:tx': (payload: ChainTransaction) => void;
  'wallet:block': (payload: { chain: string; height: number; at: number }) => void;

  'notification:new': (payload: Notification) => void;
  'chat:message': (payload: ChatMessage) => void;
  'chat:presence': (payload: { room: string; online: number }) => void;

  'leaderboard:update': (payload: { top: Array<{ userId: number; displayName: string; netWorth: string; rank: number }> }) => void;
  'company:update': (payload: { companyId: number; sharePrice: string; treasury: string; marketCap: string }) => void;
  'market:settled': (payload: { marketId: number; winningOutcomeId: number; payout: string | null }) => void;

  'engine:status': (payload: { tick: number; at: number; assets: number; latencyMs: number }) => void;
  error: (payload: { code: string; message: string }) => void;
}

/** Client → server. Every subscribe call is acked so the client knows it landed. */
export interface ClientToServerEvents {
  'subscribe:prices': (ack: (ok: boolean) => void) => void;
  'unsubscribe:prices': () => void;
  'subscribe:asset': (payload: { ticker: string; interval?: string }, ack: (ok: boolean) => void) => void;
  'unsubscribe:asset': (payload: { ticker: string }) => void;
  'subscribe:book': (payload: { ticker: string }, ack: (ok: boolean) => void) => void;
  'unsubscribe:book': (payload: { ticker: string }) => void;
  'subscribe:chat': (payload: { room: string }, ack: (ok: boolean) => void) => void;
  'unsubscribe:chat': (payload: { room: string }) => void;
  'subscribe:company': (payload: { companyId: number }, ack: (ok: boolean) => void) => void;
  'subscribe:leaderboard': (ack: (ok: boolean) => void) => void;
  'chat:send': (payload: { room: string; body: string }, ack: (res: { ok: boolean; error?: string }) => void) => void;
  ping: (ack: (at: number) => void) => void;
}

export interface SocketData {
  userId: number | null;
  role: string;
  subscribedAssets: Set<string>;
}

export const SOCKET_PATH = '/ws';
