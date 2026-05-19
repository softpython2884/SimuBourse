import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations, desc, sql } from 'drizzle-orm';

// SQLite's CURRENT_TIMESTAMP returns a string like '2024-01-01 12:00:00', which is
// incompatible with timestamp_ms mode. We use unixepoch() * 1000 to get a real
// millisecond unix timestamp that Drizzle can parse back into a Date.
const tsDefault = sql`(unixepoch() * 1000)`;

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phoneNumber: text('phone_number'),
  role: text('role', { enum: ['user', 'admin'] }).default('user').notNull(),
  cash: real('cash').default(100000.00).notNull(),
  initialCash: real('initial_cash').default(100000.00).notNull(),
  unclaimedBtc: real('unclaimed_btc').default(0).notNull(),
  lastMiningUpdateAt: integer('last_mining_update_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  holdings: many(holdings),
  transactions: many(transactions),
  predictionMarkets: many(predictionMarkets),
  marketBets: many(marketBets),
  miningRigs: many(userMiningRigs),
  companyMemberships: many(companyMembers),
  createdCompanies: many(companies),
  companyShares: many(companyShares),
  automaticOrders: many(automaticOrders),
}));

export const assets = sqliteTable('assets', {
  ticker: text('ticker').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  price: real('price').notNull(),
  change24h: text('change_24h').notNull(),
  marketCap: text('market_cap').notNull(),
});

export const holdings = sqliteTable('holdings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  quantity: real('quantity').notNull(),
  avgCost: real('avg_cost').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    userTickerIdx: uniqueIndex('user_ticker_idx').on(table.userId, table.ticker),
    holdingsUserIdx: index('idx_holdings_user_id').on(table.userId),
  }
});

export const holdingsRelations = relations(holdings, ({ one, many }) => ({
  user: one(users, {
    fields: [holdings.userId],
    references: [users.id],
  }),
  automaticOrders: many(automaticOrders),
}));

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['Buy', 'Sell'] }).notNull(),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  price: real('price').notNull(),
  value: real('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    transactionsUserIdx: index('idx_transactions_user_id').on(table.userId),
    transactionsUserCreatedIdx: index('idx_transactions_user_created').on(table.userId, desc(table.createdAt)),
  }
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const aiNews = sqliteTable('ai_news', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  headline: text('headline').notNull(),
  article: text('article').notNull(),
  sentiment: text('sentiment', { enum: ['positive', 'negative', 'neutral'] }).notNull(),
  impactScore: integer('impact_score').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    tickerCreatedAtIdx: index('ticker_created_at_idx').on(table.ticker, desc(table.createdAt)),
  }
});


// Prediction Markets
export const predictionMarkets = sqliteTable('prediction_markets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  status: text('status', { enum: ['open', 'closed', 'settled'] }).default('open').notNull(),
  totalPool: real('total_pool').default(0.00).notNull(),
  closingAt: integer('closing_at', { mode: 'timestamp_ms' }).notNull(),
  winningOutcomeId: integer('winning_outcome_id'),
  creatorId: integer('creator_id').references(() => users.id, { onDelete: 'set null' }),
  creatorDisplayName: text('creator_display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    marketsStatusIdx: index('idx_markets_status').on(table.status),
    marketsClosingIdx: index('idx_markets_closing_at').on(table.closingAt),
  }
});

export const predictionMarketsRelations = relations(predictionMarkets, ({ one, many }) => ({
  creator: one(users, {
    fields: [predictionMarkets.creatorId],
    references: [users.id],
  }),
  outcomes: many(marketOutcomes),
}));

export const marketOutcomes = sqliteTable('market_outcomes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  marketId: integer('market_id').notNull().references(() => predictionMarkets.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  pool: real('pool').default(0.00).notNull(),
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

export const marketBets = sqliteTable('market_bets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  outcomeId: integer('outcome_id').notNull().references(() => marketOutcomes.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  payout: real('payout').default(0).notNull(),
  status: text('status', { enum: ['active', 'won', 'lost', 'refunded'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    betsUserIdx: index('idx_market_bets_user_id').on(table.userId),
    betsOutcomeIdx: index('idx_market_bets_outcome_id').on(table.outcomeId),
  }
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

export const userMiningRigs = sqliteTable('user_mining_rigs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rigId: text('rig_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
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

// Companies
export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  ticker: text('ticker').notNull().unique(),
  industry: text('industry').notNull(),
  description: text('description').notNull(),
  cash: real('cash').default(0.00).notNull(),
  creatorId: integer('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sharePrice: real('share_price').default(1.00).notNull(),
  totalShares: real('total_shares').default(1000.00).notNull(),
  isListed: integer('is_listed', { mode: 'boolean' }).default(false).notNull(),
  unclaimedBtc: real('unclaimed_btc').default(0).notNull(),
  lastMiningUpdateAt: integer('last_mining_update_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
});

export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, {
    fields: [companies.creatorId],
    references: [users.id],
  }),
  members: many(companyMembers),
  shares: many(companyShares),
  holdings: many(companyHoldings),
  miningRigs: many(companyMiningRigs),
  transactions: many(companyTransactions),
}));

export const companyMembers = sqliteTable('company_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['ceo', 'manager', 'member'] }).notNull(),
}, (table) => {
  return {
    companyUserIdx: uniqueIndex('company_user_idx').on(table.companyId, table.userId),
  }
});

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
  }),
}));


export const companyShares = sqliteTable('company_shares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quantity: real('quantity').notNull(),
  avgCost: real('avg_cost').default(0).notNull(),
}, (table) => {
  return {
    companyUserSharesIdx: uniqueIndex('company_user_shares_idx').on(table.companyId, table.userId),
    sharesUserIdx: index('idx_company_shares_user_id').on(table.userId),
  }
});

export const companySharesRelations = relations(companyShares, ({ one }) => ({
  company: one(companies, {
    fields: [companyShares.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyShares.userId],
    references: [users.id],
  }),
}));

export const companyHoldings = sqliteTable('company_holdings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  quantity: real('quantity').notNull(),
  avgCost: real('avg_cost').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    companyTickerIdx: uniqueIndex('company_holdings_ticker_idx').on(table.companyId, table.ticker),
  }
});

export const companyHoldingsRelations = relations(companyHoldings, ({ one }) => ({
  company: one(companies, {
    fields: [companyHoldings.companyId],
    references: [companies.id],
  }),
}));

export const companyMiningRigs = sqliteTable('company_mining_rigs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  rigId: text('rig_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    companyRigIdx: uniqueIndex('company_rig_idx').on(table.companyId, table.rigId),
  }
});

export const companyMiningRigsRelations = relations(companyMiningRigs, ({ one }) => ({
  company: one(companies, {
    fields: [companyMiningRigs.companyId],
    references: [companies.id],
  }),
}));

export const companyTransactions = sqliteTable('company_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['Buy', 'Sell'] }).notNull(),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  price: real('price').notNull(),
  value: real('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    companyTransactionsCompanyIdx: index('idx_company_transactions_company_id').on(table.companyId),
  }
});

export const companyTransactionsRelations = relations(companyTransactions, ({ one }) => ({
  company: one(companies, {
    fields: [companyTransactions.companyId],
    references: [companies.id],
  }),
}));


export const automaticOrders = sqliteTable('automatic_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  holdingId: integer('holding_id').notNull().references(() => holdings.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['stop-loss', 'take-profit'] }).notNull(),
  triggerPrice: real('trigger_price').notNull(),
  quantity: real('quantity').notNull(),
  status: text('status', { enum: ['active', 'triggered', 'cancelled'] }).default('active').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(tsDefault).notNull(),
}, (table) => {
  return {
    userHoldingIdx: index('auto_order_user_holding_idx').on(table.userId, table.holdingId),
  }
});

export const automaticOrdersRelations = relations(automaticOrders, ({ one }) => ({
  user: one(users, {
    fields: [automaticOrders.userId],
    references: [users.id],
  }),
  holding: one(holdings, {
    fields: [automaticOrders.holdingId],
    references: [holdings.id],
  }),
}));
