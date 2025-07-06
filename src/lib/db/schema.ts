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
  predictionMarkets: many(predictionMarkets),
  marketBets: many(marketBets),
  miningRigs: many(userMiningRigs),
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


// Prediction Markets
export const predictionMarkets = pgTable('prediction_markets', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  category: varchar('category', { length: 256 }).notNull(),
  status: varchar('status', { length: 10, enum: ['open', 'closed', 'settled'] }).default('open').notNull(),
  totalPool: numeric('total_pool', { precision: 15, scale: 2 }).default('0.00').notNull(),
  closingAt: timestamp('closing_at', { withTimezone: true }).notNull(),
  creatorId: integer('creator_id').references(() => users.id, { onDelete: 'set null' }),
  creatorDisplayName: varchar('creator_display_name', { length: 256 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const predictionMarketsRelations = relations(predictionMarkets, ({ one, many }) => ({
  creator: one(users, {
    fields: [predictionMarkets.creatorId],
    references: [users.id],
  }),
  outcomes: many(marketOutcomes),
}));

export const marketOutcomes = pgTable('market_outcomes', {
  id: serial('id').primaryKey(),
  marketId: integer('market_id').notNull().references(() => predictionMarkets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  pool: numeric('pool', { precision: 15, scale: 2 }).default('0.00').notNull(),
}, (table) => {
  return {
    marketIdIdx: index('market_id_idx').on(table.marketId),
  }
});

export const marketOutcomesRelations = relations(marketOutcomes, ({ one, many }) => ({
  market: one(predictionMarkets, {
    fields: [marketOutcomes.marketId],
    references: [predictionMarkets.id],
  }),
  bets: many(marketBets),
}));

export const marketBets = pgTable('market_bets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  outcomeId: integer('outcome_id').notNull().references(() => marketOutcomes.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const marketBetsRelations = relations(marketBets, ({ one }) => ({
  user: one(users, {
    fields: [marketBets.userId],
    references: [users.id],
  }),
  outcome: one(marketOutcomes, {
    fields: [marketBets.outcomeId],
    references: [marketOutcomes.id],
  }),
}));

export const userMiningRigs = pgTable('user_mining_rigs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rigId: varchar('rig_id', { length: 50 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userRigIdx: uniqueIndex('user_rig_idx').on(table.userId, table.rigId),
  }
});

export const userMiningRigsRelations = relations(userMiningRigs, ({ one }) => ({
  user: one(users, {
    fields: [userMiningRigs.userId],
    references: [users.id],
  }),
}));