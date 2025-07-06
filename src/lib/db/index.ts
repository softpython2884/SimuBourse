import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import *d from 'dotenv';
d.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error("La variable d'environnement DATABASE_URL est manquante.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
