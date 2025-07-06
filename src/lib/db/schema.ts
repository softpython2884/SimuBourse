import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  numeric,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, desc } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  displayName: varchar('display_name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }),
  cash: numeric('cash', { precision: 15, scale: 2 }).default('100000.00').notNull(),
  initialCash: numeric('initial_cash', { precision: 15, scale: 2 }).default('100000.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  holdings: many(holdings),
  transactions: many(transactions),
}));

export const holdings = pgTable('holdings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }).notNull(),
  avgCost: numeric('avg_cost', { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userTickerIdx: uniqueIndex('user_ticker_idx').on(table.userId, table.ticker),
  }
});

export const holdingsRelations = relations(holdings, ({ one }) => ({
  user: one(users, {
    fields: [holdings.userId],
    references: [users.id],
  }),
}));

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 4 }).notNull(), // 'Buy' or 'Sell'
  ticker: varchar('ticker', { length: 10 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }).notNull(),
  price: numeric('price', { precision: 18, scale: 8 }).notNull(),
  value: numeric('value', { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const aiNews = pgTable('ai_news', {
  id: serial('id').primaryKey(),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  headline: text('headline').notNull(),
  article: text('article').notNull(),
  sentiment: varchar('sentiment', { length: 10, enum: ['positive', 'negative', 'neutral'] }).notNull(),
  impactScore: integer('impact_score').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    tickerCreatedAtIdx: index('ticker_created_at_idx').on(table.ticker, desc(table.createdAt)),
  }
});
