import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { initializeDatabase } from './init';

declare global {
  var __sqlite: Database.Database | undefined;
  var __dbInitialized: boolean | undefined;
}

function createSqlite(): Database.Database {
  const sqlite = new Database('sqlite.db', { timeout: 10000 });
  try { sqlite.pragma('journal_mode = WAL'); } catch {}
  try { sqlite.pragma('busy_timeout = 10000'); } catch {}
  try { sqlite.pragma('synchronous = NORMAL'); } catch {}
  try { sqlite.pragma('foreign_keys = ON'); } catch {}
  return sqlite;
}

// Cache the connection across HMR + build workers so we don't double-open the file.
const sqlite: Database.Database = globalThis.__sqlite ?? createSqlite();
globalThis.__sqlite = sqlite;

// Initialize lazily and only once. Tolerates SQLITE_BUSY (another worker may already
// be running the same statements) — the CREATE TABLE IF NOT EXISTS clauses make
// this safe to skip when contended.
if (!globalThis.__dbInitialized) {
  try {
    initializeDatabase(sqlite);
    globalThis.__dbInitialized = true;
  } catch (err: any) {
    if (err?.code === 'SQLITE_BUSY') {
      console.warn('[db] init skipped (another worker is initializing).');
    } else {
      console.error('[db] init failed:', err);
    }
  }
}

export const db = drizzle(sqlite, { schema });
export const rawSqlite = sqlite;
