import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDb } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '../migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const { sql, db } = createDb({ url, max: 1, connectTimeoutSeconds: 30 });
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] done.');
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error('[migrate] failed:', error);
  process.exit(1);
});
