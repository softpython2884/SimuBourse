import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import * as d from 'dotenv';
import { initializeDatabase } from './init';
d.config({ path: '.env' });

const sqlite = new Database('sqlite.db');

// This will run once to ensure the database schema is created.
initializeDatabase(sqlite);

export const db = drizzle(sqlite, { schema });
