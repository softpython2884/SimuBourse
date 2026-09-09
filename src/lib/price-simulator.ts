import 'server-only';
import { db, rawSqlite } from './db';
import { assets as assetsSchema } from './db/schema';
import { assets as seedAssets } from './assets';
import { eq } from 'drizzle-orm';

export type PriceUpdate = {
  ticker: string;
  price: number;
  change24h: string;
  type: string;
};

type Listener = (updates: PriceUpdate[]) => void;

const TICK_INTERVAL_MS = 3000;

// Singleton state preserved across HMR reloads in dev.
declare global {
  var __priceSimulator: {
    initialPrices: Map<string, number>;
    listeners: Set<Listener>;
    timer: NodeJS.Timeout | null;
    starting: Promise<void> | null;
    lastSnapshot: PriceUpdate[];
  } | undefined;
}

function getState() {
  if (!globalThis.__priceSimulator) {
    globalThis.__priceSimulator = {
      initialPrices: new Map(),
      listeners: new Set(),
      timer: null,
      starting: null,
      lastSnapshot: [],
    };
  }
  return globalThis.__priceSimulator;
}

async function ensureAssetsSeeded() {
  const count = rawSqlite.prepare('SELECT COUNT(*) as c FROM assets').get() as { c: number };
  if (count.c === 0) {
    console.log('[price-simulator] Seeding initial assets...');
    const insert = rawSqlite.prepare(
      `INSERT INTO assets (ticker, name, description, type, price, change_24h, market_cap)
       VALUES (@ticker, @name, @description, @type, @price, @change24h, @marketCap)`
    );
    const tx = rawSqlite.transaction((items: typeof seedAssets) => {
      for (const a of items) insert.run({
        ticker: a.ticker,
        name: a.name,
        description: a.description,
        type: a.type,
        price: a.price,
        change24h: a.change24h,
        marketCap: a.marketCap,
      });
    });
    tx(seedAssets);
  }
}

async function loadInitialPrices() {
  const state = getState();
  const rows = await db.query.assets.findMany();
  state.initialPrices.clear();
  for (const row of rows) {
    state.initialPrices.set(row.ticker, row.price);
  }
  state.lastSnapshot = rows.map(r => ({
    ticker: r.ticker,
    price: r.price,
    change24h: r.change24h,
    type: r.type,
  }));
}

function tick() {
  const state = getState();
  const rows = rawSqlite.prepare('SELECT ticker, name, type, price FROM assets').all() as Array<{
    ticker: string;
    name: string;
    type: string;
    price: number;
  }>;

  const updates: PriceUpdate[] = [];
  const updateStmt = rawSqlite.prepare('UPDATE assets SET price = ?, change_24h = ? WHERE ticker = ?');

  const applyAll = rawSqlite.transaction(() => {
    for (const row of rows) {
      const initial = state.initialPrices.get(row.ticker) ?? row.price;
      const volatility = row.type === 'Crypto' || row.type === 'Forex' ? 0.015 : 0.005;
      const change = 1 + (Math.random() - 0.5) * 2 * volatility;
      let newPrice = row.price * change;
      if (!isFinite(newPrice) || newPrice <= 0) newPrice = initial;

      const pct = ((newPrice - initial) / initial) * 100;
      const sign = pct >= 0 ? '+' : '';
      const change24h = `${sign}${pct.toFixed(2)}%`;

      updateStmt.run(newPrice, change24h, row.ticker);
      updates.push({ ticker: row.ticker, price: newPrice, change24h, type: row.type });
    }
  });
  applyAll();

  state.lastSnapshot = updates;
  for (const fn of state.listeners) {
    try { fn(updates); } catch (err) { console.error('[price-simulator] listener error:', err); }
  }
}

export async function startPriceSimulator() {
  const state = getState();
  if (state.timer) return;
  if (state.starting) return state.starting;

  state.starting = (async () => {
    await ensureAssetsSeeded();
    await loadInitialPrices();
    state.timer = setInterval(tick, TICK_INTERVAL_MS);
    console.log('[price-simulator] Started.');
  })();

  return state.starting;
}

export async function getPriceSnapshot(): Promise<PriceUpdate[]> {
  const state = getState();
  if (state.lastSnapshot.length === 0) {
    await startPriceSimulator();
  }
  return state.lastSnapshot;
}

export function subscribePrices(fn: Listener): () => void {
  const state = getState();
  state.listeners.add(fn);
  return () => { state.listeners.delete(fn); };
}
