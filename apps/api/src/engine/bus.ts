import { EventEmitter } from 'node:events';
import type { Candle, MarketEvent, Order, PriceTick, Trade } from '@alvora/shared';

/**
 * In-process event bus between the simulation engine and everything that reacts
 * to it (the realtime gateway, alerts, achievements). Keeping the engine free of
 * direct Socket.IO references means it can run headless in tests.
 */
export interface EngineEvents {
  tick: [{ ticks: PriceTick[]; at: number; sequence: number }];
  candle: [{ ticker: string; interval: string; candle: Candle }];
  trade: [Trade & { buyerId: number | null; sellerId: number | null; buyerKind: string | null; sellerKind: string | null }];
  book: [{ ticker: string }];
  orderUpdate: [{ userId: number; order: Order }];
  orderFill: [
    {
      userId: number;
      orderId: number;
      ticker: string;
      side: 'buy' | 'sell';
      quantity: string;
      price: string;
      fee: string;
      isFinal: boolean;
    },
  ];
  marketEvent: [MarketEvent];
  block: [{ chain: string; height: number; at: number }];
  chainTx: [{ userId: number; tx: Record<string, unknown> }];
  portfolioDirty: [{ userId: number }];
  companyUpdate: [{ companyId: number; sharePrice: string; treasury: string; marketCap: string }];
  predictionSettled: [{ marketId: number; winningOutcomeId: number }];
}

export type EngineEventName = keyof EngineEvents;

export class EngineBus {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  constructor() {
    // A slow consumer must never take the tick loop down.
    this.emitter.setMaxListeners(100);
    this.emitter.on('error', () => {});
  }

  emit<K extends EngineEventName>(event: K, ...args: EngineEvents[K]): void {
    this.emitter.emit(event, ...args);
  }

  on<K extends EngineEventName>(event: K, listener: (...args: EngineEvents[K]) => void): () => void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return () => this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  off<K extends EngineEventName>(event: K, listener: (...args: EngineEvents[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}
