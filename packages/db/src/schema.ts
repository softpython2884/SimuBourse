/**
 * Alvora database schema (PostgreSQL).
 *
 * Conventions:
 *  - Every monetary amount, quantity and price uses the `fixed` column type:
 *    an exact 1e8-scaled integer. No `real`, no `double precision`, ever.
 *  - Cash never moves without a matching `ledger` row, so any balance can be
 *    reconstructed and audited. The legacy app mutated `users.cash` directly
 *    from a dozen places with no trail, which is why balances drifted.
 *  - Anything a player can spend twice (cash, holdings, wallet balances) has an
 *    explicit `locked*` column reserved by resting orders and escrows.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { bigCount, fixed } from './types.js';

const now = sql`now()`;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull(),
};

// ===========================================================================
// Identity
// ===========================================================================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    displayName: varchar('display_name', { length: 32 }).notNull(),
    /** Lower-cased copy used for the uniqueness constraint and lookups. */
    displayNameKey: varchar('display_name_key', { length: 32 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 16, enum: ['user', 'moderator', 'admin'] }).default('user').notNull(),
    status: varchar('status', { length: 16, enum: ['active', 'suspended', 'banned'] }).default('active').notNull(),
    statusReason: text('status_reason'),

    /** Spendable cash. */
    cash: fixed('cash').default(sql`0`).notNull(),
    /** Cash reserved by resting buy orders and escrows. Never spendable. */
    lockedCash: fixed('locked_cash').default(sql`0`).notNull(),
    initialCash: fixed('initial_cash').default(sql`0`).notNull(),
    realizedPnl: fixed('realized_pnl').default(sql`0`).notNull(),

    bio: text('bio'),
    avatarColor: varchar('avatar_color', { length: 7 }).default('#5b8def').notNull(),
    isPortfolioPublic: boolean('is_portfolio_public').default(true).notNull(),
    locale: varchar('locale', { length: 8 }).default('fr').notNull(),

    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastDailyBonusAt: timestamp('last_daily_bonus_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_key').on(t.email),
    uniqueIndex('users_display_name_key').on(t.displayNameKey),
    index('users_status_idx').on(t.status),
  ],
);

/** Refresh tokens, stored hashed so a database leak cannot mint sessions. */
export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    /** Set when the token is rotated, to detect replay of a stolen token. */
    replacedById: integer('replaced_by_id'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: varchar('user_agent', { length: 256 }),
    ip: varchar('ip', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 254 }).notNull(),
    ip: varchar('ip', { length: 64 }).notNull(),
    success: boolean('success').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('login_attempts_lookup_idx').on(t.email, t.ip, t.createdAt)],
);

// ===========================================================================
// Assets & market data
// ===========================================================================

export const assets = pgTable(
  'assets',
  {
    ticker: varchar('ticker', { length: 12 }).primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    assetClass: varchar('asset_class', { length: 16 }).notNull(),
    description: text('description').default('').notNull(),

    price: fixed('price').notNull(),
    /** Long-run anchor the random walk mean-reverts toward. */
    anchorPrice: fixed('anchor_price').notNull(),
    previousClose: fixed('previous_close').notNull(),
    high24h: fixed('high_24h').default(sql`0`).notNull(),
    low24h: fixed('low_24h').default(sql`0`).notNull(),
    volume24h: fixed('volume_24h').default(sql`0`).notNull(),

    circulatingSupply: fixed('circulating_supply'),
    marketCap: fixed('market_cap'),

    /** Volatility override in bps; falls back to the asset-class default. */
    sigmaBps: integer('sigma_bps'),
    driftBps: integer('drift_bps'),

    /** Set for assets that are a player company's listed stock. */
    companyId: integer('company_id'),
    /** Set for crypto assets that have an on-chain wallet counterpart. */
    chain: varchar('chain', { length: 12 }),

    isTradable: boolean('is_tradable').default(true).notNull(),
    /** Order-book trading vs. instant fills against the simulated market maker. */
    hasOrderBook: boolean('has_order_book').default(true).notNull(),
    logoSeed: varchar('logo_seed', { length: 32 }).default('').notNull(),
    ...timestamps,
  },
  (t) => [
    index('assets_class_idx').on(t.assetClass),
    index('assets_tradable_idx').on(t.isTradable),
    uniqueIndex('assets_company_key').on(t.companyId),
  ],
);

export const candles = pgTable(
  'candles',
  {
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),
    interval: varchar('interval', { length: 4 }).notNull(),
    /** Bucket start. */
    bucket: timestamp('bucket', { withTimezone: true }).notNull(),
    open: fixed('open').notNull(),
    high: fixed('high').notNull(),
    low: fixed('low').notNull(),
    close: fixed('close').notNull(),
    volume: fixed('volume').default(sql`0`).notNull(),
    trades: integer('trades').default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ticker, t.interval, t.bucket] }),
    index('candles_lookup_idx').on(t.ticker, t.interval, t.bucket.desc()),
  ],
);

export const marketEvents = pgTable(
  'market_events',
  {
    id: serial('id').primaryKey(),
    /** Null for market-wide events. */
    ticker: varchar('ticker', { length: 12 }),
    headline: text('headline').notNull(),
    body: text('body').notNull(),
    sentiment: varchar('sentiment', { length: 10, enum: ['positive', 'negative', 'neutral'] }).notNull(),
    magnitude: varchar('magnitude', { length: 10, enum: ['minor', 'moderate', 'major', 'shock'] }).notNull(),
    impactBps: integer('impact_bps').notNull(),
    source: varchar('source', { length: 10, enum: ['engine', 'ai', 'admin', 'company'] }).default('engine').notNull(),
    /** Pressure decays to zero at this instant. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('market_events_ticker_idx').on(t.ticker, t.createdAt.desc()), index('market_events_expiry_idx').on(t.expiresAt)],
);

// ===========================================================================
// Trading
// ===========================================================================

/** An account that can hold value: a player or a company. */
export const OWNER_KINDS = ['user', 'company'] as const;

export const holdings = pgTable(
  'holdings',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),
    quantity: fixed('quantity').default(sql`0`).notNull(),
    /** Reserved by resting sell orders / OTC escrow. */
    lockedQuantity: fixed('locked_quantity').default(sql`0`).notNull(),
    averageCost: fixed('average_cost').default(sql`0`).notNull(),
    realizedPnl: fixed('realized_pnl').default(sql`0`).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('holdings_owner_ticker_key').on(t.ownerKind, t.ownerId, t.ticker),
    index('holdings_ticker_idx').on(t.ticker),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    /** The player who submitted the order, even when trading for a company. */
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),

    side: varchar('side', { length: 4, enum: ['buy', 'sell'] }).notNull(),
    type: varchar('type', { length: 16, enum: ['market', 'limit', 'stop', 'stop_limit', 'trailing_stop'] }).notNull(),
    status: varchar('status', { length: 10, enum: ['open', 'partial', 'filled', 'cancelled', 'rejected', 'expired'] })
      .default('open')
      .notNull(),
    timeInForce: varchar('time_in_force', { length: 4, enum: ['gtc', 'ioc', 'fok', 'day'] }).default('gtc').notNull(),

    quantity: fixed('quantity').notNull(),
    filledQuantity: fixed('filled_quantity').default(sql`0`).notNull(),
    limitPrice: fixed('limit_price'),
    stopPrice: fixed('stop_price'),
    trailPercent: fixed('trail_percent'),
    /** Best price seen since submission, for trailing stops. */
    trailAnchor: fixed('trail_anchor'),

    /** Cash (buy) or quantity (sell) reserved for the unfilled remainder. */
    reservedCash: fixed('reserved_cash').default(sql`0`).notNull(),
    reservedQuantity: fixed('reserved_quantity').default(sql`0`).notNull(),

    averagePrice: fixed('average_price').default(sql`0`).notNull(),
    feePaid: fixed('fee_paid').default(sql`0`).notNull(),
    rejectReason: text('reject_reason'),
    clientOrderId: varchar('client_order_id', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('orders_book_idx').on(t.ticker, t.status, t.side, t.limitPrice, t.createdAt),
    index('orders_owner_idx').on(t.ownerKind, t.ownerId, t.status),
    index('orders_user_idx').on(t.userId, t.createdAt.desc()),
    index('orders_trigger_idx').on(t.status, t.type),
    uniqueIndex('orders_client_id_key').on(t.userId, t.clientOrderId),
  ],
);

export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),
    price: fixed('price').notNull(),
    quantity: fixed('quantity').notNull(),
    value: fixed('value').notNull(),

    buyOrderId: integer('buy_order_id'),
    sellOrderId: integer('sell_order_id'),
    buyerKind: varchar('buyer_kind', { length: 8 }),
    buyerId: integer('buyer_id'),
    sellerKind: varchar('seller_kind', { length: 8 }),
    sellerId: integer('seller_id'),
    buyerFee: fixed('buyer_fee').default(sql`0`).notNull(),
    sellerFee: fixed('seller_fee').default(sql`0`).notNull(),
    /** True when one leg is the simulated market maker rather than a player. */
    isSynthetic: boolean('is_synthetic').default(false).notNull(),
    /** Which side crossed the spread — drives the price-impact direction. */
    takerSide: varchar('taker_side', { length: 4, enum: ['buy', 'sell'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [
    index('trades_ticker_idx').on(t.ticker, t.createdAt.desc()),
    index('trades_buyer_idx').on(t.buyerKind, t.buyerId, t.createdAt.desc()),
    index('trades_seller_idx').on(t.sellerKind, t.sellerId, t.createdAt.desc()),
  ],
);

/**
 * Double-entry-ish cash ledger. Every credit or debit of `users.cash` or
 * `companies.treasury` writes exactly one row, with the resulting balance.
 */
export const ledger = pgTable(
  'ledger',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    /** Signed: positive credits, negative debits. */
    amount: fixed('amount').notNull(),
    balanceAfter: fixed('balance_after').notNull(),
    ticker: varchar('ticker', { length: 12 }),
    quantity: fixed('quantity'),
    price: fixed('price'),
    description: text('description').default('').notNull(),
    counterpartyKind: varchar('counterparty_kind', { length: 8 }),
    counterpartyId: integer('counterparty_id'),
    refType: varchar('ref_type', { length: 24 }),
    refId: integer('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [
    index('ledger_owner_idx').on(t.ownerKind, t.ownerId, t.createdAt.desc()),
    index('ledger_kind_idx').on(t.kind, t.createdAt.desc()),
  ],
);

/** Net-worth samples, so the portfolio chart is real history rather than a guess. */
export const netWorthHistory = pgTable(
  'net_worth_history',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bucket: timestamp('bucket', { withTimezone: true }).notNull(),
    netWorth: fixed('net_worth').notNull(),
    cash: fixed('cash').notNull(),
    holdingsValue: fixed('holdings_value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bucket] })],
);

// ===========================================================================
// Crypto wallets & simulated chains
// ===========================================================================

export const chainBlocks = pgTable(
  'chain_blocks',
  {
    id: serial('id').primaryKey(),
    chain: varchar('chain', { length: 12 }).notNull(),
    height: integer('height').notNull(),
    hash: varchar('hash', { length: 64 }).notNull(),
    /** Total network hashrate at the time the block was found. */
    networkHashrate: real('network_hashrate').default(0).notNull(),
    reward: fixed('reward').default(sql`0`).notNull(),
    minedAt: timestamp('mined_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [uniqueIndex('chain_blocks_key').on(t.chain, t.height), index('chain_blocks_time_idx').on(t.chain, t.minedAt.desc())],
);

export const wallets = pgTable(
  'wallets',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    chain: varchar('chain', { length: 12 }).notNull(),
    address: varchar('address', { length: 80 }).notNull(),
    label: varchar('label', { length: 48 }).default('').notNull(),
    balance: fixed('balance').default(sql`0`).notNull(),
    /** Incoming amounts still short of the confirmation threshold. */
    pendingBalance: fixed('pending_balance').default(sql`0`).notNull(),
    /** Outgoing amounts already debited but not yet confirmed. */
    lockedBalance: fixed('locked_balance').default(sql`0`).notNull(),
    stakedBalance: fixed('staked_balance').default(sql`0`).notNull(),
    isPrimary: boolean('is_primary').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wallets_address_key').on(t.address),
    uniqueIndex('wallets_owner_chain_key').on(t.ownerKind, t.ownerId, t.chain),
  ],
);

export const chainTransactions = pgTable(
  'chain_transactions',
  {
    id: serial('id').primaryKey(),
    hash: varchar('hash', { length: 64 }).notNull(),
    chain: varchar('chain', { length: 12 }).notNull(),
    fromAddress: varchar('from_address', { length: 80 }).notNull(),
    toAddress: varchar('to_address', { length: 80 }).notNull(),
    fromWalletId: integer('from_wallet_id'),
    toWalletId: integer('to_wallet_id'),
    amount: fixed('amount').notNull(),
    fee: fixed('fee').default(sql`0`).notNull(),
    status: varchar('status', { length: 12, enum: ['pending', 'confirming', 'confirmed', 'failed'] })
      .default('pending')
      .notNull(),
    confirmations: integer('confirmations').default(0).notNull(),
    requiredConfirmations: integer('required_confirmations').notNull(),
    blockHeight: integer('block_height'),
    /** deposit/withdraw move value between the exchange balance and the chain. */
    kind: varchar('kind', { length: 12, enum: ['transfer', 'deposit', 'withdraw', 'mining', 'staking', 'swap', 'fee'] })
      .default('transfer')
      .notNull(),
    memo: varchar('memo', { length: 140 }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('chain_tx_hash_key').on(t.hash),
    index('chain_tx_from_idx').on(t.fromWalletId, t.createdAt.desc()),
    index('chain_tx_to_idx').on(t.toWalletId, t.createdAt.desc()),
    index('chain_tx_pending_idx').on(t.status, t.chain),
  ],
);

export const stakes = pgTable(
  'stakes',
  {
    id: serial('id').primaryKey(),
    walletId: integer('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
    chain: varchar('chain', { length: 12 }).notNull(),
    amount: fixed('amount').notNull(),
    apyBps: integer('apy_bps').notNull(),
    rewardAccrued: fixed('reward_accrued').default(sql`0`).notNull(),
    status: varchar('status', { length: 16, enum: ['active', 'unstaked', 'unstaked_early'] }).default('active').notNull(),
    lastAccruedAt: timestamp('last_accrued_at', { withTimezone: true }).default(now).notNull(),
    unlocksAt: timestamp('unlocks_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('stakes_wallet_idx').on(t.walletId, t.status), index('stakes_accrual_idx').on(t.status, t.lastAccruedAt)],
);

export const addressBook = pgTable(
  'address_book',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 48 }).notNull(),
    chain: varchar('chain', { length: 12 }).notNull(),
    address: varchar('address', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [uniqueIndex('address_book_key').on(t.userId, t.chain, t.address)],
);

// ===========================================================================
// Mining
// ===========================================================================

export const miningRigs = pgTable(
  'mining_rigs',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    rigId: varchar('rig_id', { length: 40 }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    /** Total paid, so resale value does not depend on today's catalogue price. */
    totalPaid: fixed('total_paid').default(sql`0`).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('mining_rigs_key').on(t.ownerKind, t.ownerId, t.rigId)],
);

export const miningRewards = pgTable(
  'mining_rewards',
  {
    id: serial('id').primaryKey(),
    ownerKind: varchar('owner_kind', { length: 8, enum: OWNER_KINDS }).notNull(),
    ownerId: integer('owner_id').notNull(),
    chain: varchar('chain', { length: 12 }).notNull(),
    blockHeight: integer('block_height').notNull(),
    hashrate: real('hashrate').notNull(),
    sharePpm: bigCount('share_ppm').notNull(),
    reward: fixed('reward').notNull(),
    electricityCost: fixed('electricity_cost').default(sql`0`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('mining_rewards_owner_idx').on(t.ownerKind, t.ownerId, t.createdAt.desc())],
);

// ===========================================================================
// Companies
// ===========================================================================

export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    nameKey: varchar('name_key', { length: 64 }).notNull(),
    ticker: varchar('ticker', { length: 8 }).notNull(),
    industry: varchar('industry', { length: 24 }).notNull(),
    description: text('description').default('').notNull(),
    logoColor: varchar('logo_color', { length: 7 }).default('#5b8def').notNull(),

    founderId: integer('founder_id').references(() => users.id, { onDelete: 'set null' }),

    treasury: fixed('treasury').default(sql`0`).notNull(),
    lockedTreasury: fixed('locked_treasury').default(sql`0`).notNull(),
    totalShares: fixed('total_shares').default(sql`0`).notNull(),
    /** Shares held by anyone other than the treasury — the tradable float. */
    floatShares: fixed('float_shares').default(sql`0`).notNull(),
    /** Shares the company holds in itself (unissued or bought back). */
    treasuryShares: fixed('treasury_shares').default(sql`0`).notNull(),
    sharePrice: fixed('share_price').default(sql`0`).notNull(),

    isListed: boolean('is_listed').default(false).notNull(),
    listedAt: timestamp('listed_at', { withTimezone: true }),
    lastDividendAt: timestamp('last_dividend_at', { withTimezone: true }),
    lastRevenueAt: timestamp('last_revenue_at', { withTimezone: true }).default(now).notNull(),

    revenue30d: fixed('revenue_30d').default(sql`0`).notNull(),
    expenses30d: fixed('expenses_30d').default(sql`0`).notNull(),
    dividendsPaid: fixed('dividends_paid').default(sql`0`).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('companies_name_key').on(t.nameKey),
    uniqueIndex('companies_ticker_key').on(t.ticker),
    index('companies_listed_idx').on(t.isListed),
    index('companies_founder_idx').on(t.founderId),
  ],
);

export const companyMembers = pgTable(
  'company_members',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 12, enum: ['ceo', 'director', 'trader', 'member'] }).notNull(),
    salary: fixed('salary').default(sql`0`).notNull(),
    lastPaidAt: timestamp('last_paid_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [uniqueIndex('company_members_key').on(t.companyId, t.userId), index('company_members_user_idx').on(t.userId)],
);

export const companyShares = pgTable(
  'company_shares',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    quantity: fixed('quantity').default(sql`0`).notNull(),
    lockedQuantity: fixed('locked_quantity').default(sql`0`).notNull(),
    averageCost: fixed('average_cost').default(sql`0`).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('company_shares_key').on(t.companyId, t.userId), index('company_shares_user_idx').on(t.userId)],
);

export const companyEvents = pgTable(
  'company_events',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    description: text('description').notNull(),
    amount: fixed('amount'),
    actorId: integer('actor_id'),
    actorName: varchar('actor_name', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('company_events_idx').on(t.companyId, t.createdAt.desc())],
);

export const dividends = pgTable(
  'dividends',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    totalAmount: fixed('total_amount').notNull(),
    perShare: fixed('per_share').notNull(),
    recipients: integer('recipients').default(0).notNull(),
    declaredBy: integer('declared_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('dividends_company_idx').on(t.companyId, t.createdAt.desc())],
);

// ===========================================================================
// Prediction markets
// ===========================================================================

export const predictionMarkets = pgTable(
  'prediction_markets',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    category: varchar('category', { length: 48 }).notNull(),
    status: varchar('status', { length: 12, enum: ['open', 'closed', 'settled', 'cancelled'] }).default('open').notNull(),
    totalPool: fixed('total_pool').default(sql`0`).notNull(),
    winningOutcomeId: integer('winning_outcome_id'),
    creatorId: integer('creator_id').references(() => users.id, { onDelete: 'set null' }),
    creatorName: varchar('creator_name', { length: 32 }).notNull(),
    closingAt: timestamp('closing_at', { withTimezone: true }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('prediction_status_idx').on(t.status, t.closingAt), index('prediction_creator_idx').on(t.creatorId)],
);

export const marketOutcomes = pgTable(
  'market_outcomes',
  {
    id: serial('id').primaryKey(),
    marketId: integer('market_id').notNull().references(() => predictionMarkets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    pool: fixed('pool').default(sql`0`).notNull(),
    betCount: integer('bet_count').default(0).notNull(),
    position: smallint('position').default(0).notNull(),
  },
  (t) => [index('market_outcomes_idx').on(t.marketId)],
);

export const marketBets = pgTable(
  'market_bets',
  {
    id: serial('id').primaryKey(),
    marketId: integer('market_id').notNull().references(() => predictionMarkets.id, { onDelete: 'cascade' }),
    outcomeId: integer('outcome_id').notNull().references(() => marketOutcomes.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    amount: fixed('amount').notNull(),
    payout: fixed('payout').default(sql`0`).notNull(),
    status: varchar('status', { length: 10, enum: ['active', 'won', 'lost', 'refunded'] }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('market_bets_user_idx').on(t.userId, t.createdAt.desc()), index('market_bets_outcome_idx').on(t.outcomeId)],
);

// ===========================================================================
// Peer-to-peer, social, banking
// ===========================================================================

export const otcOffers = pgTable(
  'otc_offers',
  {
    id: serial('id').primaryKey(),
    makerId: integer('maker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    offerTicker: varchar('offer_ticker', { length: 12 }).notNull(),
    offerQuantity: fixed('offer_quantity').notNull(),
    wantTicker: varchar('want_ticker', { length: 12 }),
    wantQuantity: fixed('want_quantity'),
    wantCash: fixed('want_cash'),
    targetUserId: integer('target_user_id'),
    takerId: integer('taker_id'),
    status: varchar('status', { length: 12, enum: ['open', 'accepted', 'cancelled', 'expired'] }).default('open').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('otc_status_idx').on(t.status, t.expiresAt), index('otc_maker_idx').on(t.makerId)],
);

export const loans = pgTable(
  'loans',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    principal: fixed('principal').notNull(),
    outstanding: fixed('outstanding').notNull(),
    interestAccrued: fixed('interest_accrued').default(sql`0`).notNull(),
    aprBps: integer('apr_bps').notNull(),
    termDays: integer('term_days').notNull(),
    status: varchar('status', { length: 12, enum: ['active', 'repaid', 'defaulted'] }).default('active').notNull(),
    lastAccruedAt: timestamp('last_accrued_at', { withTimezone: true }).default(now).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('loans_user_idx').on(t.userId, t.status), index('loans_accrual_idx').on(t.status, t.lastAccruedAt)],
);

export const watchlist = pgTable(
  'watchlist',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ticker] })],
);

export const priceAlerts = pgTable(
  'price_alerts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 12 }).notNull().references(() => assets.ticker, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 6, enum: ['above', 'below'] }).notNull(),
    price: fixed('price').notNull(),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('price_alerts_active_idx').on(t.ticker, t.triggeredAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    title: varchar('title', { length: 140 }).notNull(),
    body: text('body').default('').notNull(),
    href: varchar('href', { length: 200 }),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.isRead, t.createdAt.desc())],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    room: varchar('room', { length: 32 }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: varchar('display_name', { length: 32 }).notNull(),
    body: varchar('body', { length: 500 }).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('chat_room_idx').on(t.room, t.createdAt.desc())],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    achievementId: varchar('achievement_id', { length: 40 }).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id'),
    actorName: varchar('actor_name', { length: 32 }),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),
    targetId: varchar('target_id', { length: 64 }),
    metadata: jsonb('metadata'),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).default(now).notNull(),
  },
  (t) => [index('audit_action_idx').on(t.action, t.createdAt.desc()), index('audit_actor_idx').on(t.actorId)],
);

/** Single-row engine state, so a restart resumes instead of resetting the world. */
export const engineState = pgTable('engine_state', {
  key: varchar('key', { length: 40 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(now).notNull(),
});

// ===========================================================================
// Relations
// ===========================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  companyMemberships: many(companyMembers),
  companyShares: many(companyShares),
  bets: many(marketBets),
  notifications: many(notifications),
  achievements: many(userAchievements),
  loans: many(loans),
  watchlist: many(watchlist),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const assetsRelations = relations(assets, ({ many, one }) => ({
  candles: many(candles),
  trades: many(trades),
  orders: many(orders),
  company: one(companies, { fields: [assets.companyId], references: [companies.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  asset: one(assets, { fields: [orders.ticker], references: [assets.ticker] }),
}));

export const companiesRelations = relations(companies, ({ many, one }) => ({
  members: many(companyMembers),
  shares: many(companyShares),
  events: many(companyEvents),
  dividends: many(dividends),
  founder: one(users, { fields: [companies.founderId], references: [users.id] }),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, { fields: [companyMembers.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyMembers.userId], references: [users.id] }),
}));

export const companySharesRelations = relations(companyShares, ({ one }) => ({
  company: one(companies, { fields: [companyShares.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyShares.userId], references: [users.id] }),
}));

export const predictionMarketsRelations = relations(predictionMarkets, ({ many, one }) => ({
  outcomes: many(marketOutcomes),
  bets: many(marketBets),
  creator: one(users, { fields: [predictionMarkets.creatorId], references: [users.id] }),
}));

export const marketOutcomesRelations = relations(marketOutcomes, ({ one, many }) => ({
  market: one(predictionMarkets, { fields: [marketOutcomes.marketId], references: [predictionMarkets.id] }),
  bets: many(marketBets),
}));

export const marketBetsRelations = relations(marketBets, ({ one }) => ({
  market: one(predictionMarkets, { fields: [marketBets.marketId], references: [predictionMarkets.id] }),
  outcome: one(marketOutcomes, { fields: [marketBets.outcomeId], references: [marketOutcomes.id] }),
  user: one(users, { fields: [marketBets.userId], references: [users.id] }),
}));

export const walletsRelations = relations(wallets, ({ many }) => ({ stakes: many(stakes) }));

export const stakesRelations = relations(stakes, ({ one }) => ({
  wallet: one(wallets, { fields: [stakes.walletId], references: [wallets.id] }),
}));
