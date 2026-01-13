import { defineConfig } from 'drizzle-kit';
import * as d from 'dotenv';
d.config({ path: '.env' });

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: './sqlite.db',
  },
});
