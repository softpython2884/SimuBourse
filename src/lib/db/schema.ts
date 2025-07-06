import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  numeric,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  displayName: varchar('display_name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  cash: numeric('cash', { precision: 15, scale: 2 }).default('100000.00').notNull(),
  initialCash: numeric('initial_cash', { precision: 15, scale: 2 }).default('100000.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
