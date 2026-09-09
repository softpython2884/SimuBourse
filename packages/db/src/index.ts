import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';

export * as schema from './schema.js';
export * from './schema.js';
export { fixed, bigCount } from './types.js';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DbOptions {
  url: string;
  max?: number;
  /** Fail fast in the API; migrations use a longer timeout. */
  connectTimeoutSeconds?: number;
  debug?: boolean;
}

let cached: { sql: Sql; db: Database } | null = null;

export function createDb(options: DbOptions): { sql: Sql; db: Database } {
  const sql = postgres(options.url, {
    max: options.max ?? 10,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
    prepare: true,
    onnotice: () => {},
    // `numeric` must stay a string so the fixed-point custom type can parse it
    // exactly; the default postgres.js behaviour is already string, this makes
    // the requirement explicit and immune to a driver default change.
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (value: string | bigint) => value.toString(),
        parse: (value: string) => value,
      },
    },
  });
  const db = drizzle(sql, { schema, logger: options.debug ?? false });
  return { sql, db };
}

/** Process-wide singleton, so pm2 restarts do not leak pools. */
export function getDb(options?: DbOptions): { sql: Sql; db: Database } {
  if (cached) return cached;
  const url = options?.url ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  cached = createDb({ ...options, url });
  return cached;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.sql.end({ timeout: 5 });
  cached = null;
}
