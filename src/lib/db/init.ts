import type { Database } from 'better-sqlite3';

const tables = [
`CREATE TABLE IF NOT EXISTS "users" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone_number" text,
	"cash" real DEFAULT 100000 NOT NULL,
	"initial_cash" real DEFAULT 100000 NOT NULL,
	"unclaimed_btc" real DEFAULT 0 NOT NULL,
	"last_mining_update_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);`,
`CREATE TABLE IF NOT EXISTS "assets" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"price" real NOT NULL,
	"change_24h" text NOT NULL,
	"market_cap" text NOT NULL
);`,
`CREATE TABLE IF NOT EXISTS "holdings" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"avg_cost" real NOT NULL,
	"updated_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "user_ticker_idx" ON "holdings" ("user_id","ticker");`,
`CREATE TABLE IF NOT EXISTS "transactions" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"quantity" real NOT NULL,
	"price" real NOT NULL,
	"value" real NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE TABLE IF NOT EXISTS "ai_news" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"ticker" text NOT NULL,
	"headline" text NOT NULL,
	"article" text NOT NULL,
	"sentiment" text NOT NULL,
	"impact_score" integer NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);`,
`CREATE INDEX IF NOT EXISTS "ticker_created_at_idx" ON "ai_news" ("ticker", "created_at" DESC);`,
`CREATE TABLE IF NOT EXISTS "prediction_markets" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"total_pool" real DEFAULT 0 NOT NULL,
	"closing_at" integer NOT NULL,
	"creator_id" integer,
	"creator_display_name" text NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE set null
);`,
`CREATE TABLE IF NOT EXISTS "market_outcomes" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"market_id" integer NOT NULL,
	"name" text NOT NULL,
	"pool" real DEFAULT 0 NOT NULL,
	FOREIGN KEY ("market_id") REFERENCES "prediction_markets"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE INDEX IF NOT EXISTS "market_id_idx" ON "market_outcomes" ("market_id");`,
`CREATE TABLE IF NOT EXISTS "market_bets" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"outcome_id" integer NOT NULL,
	"amount" real NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("outcome_id") REFERENCES "market_outcomes"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE TABLE IF NOT EXISTS "user_mining_rigs" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"rig_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "user_rig_idx" ON "user_mining_rigs" ("user_id","rig_id");`,
`CREATE TABLE IF NOT EXISTS "companies" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"ticker" text NOT NULL,
	"industry" text NOT NULL,
	"description" text NOT NULL,
	"cash" real DEFAULT 0 NOT NULL,
	"creator_id" integer NOT NULL,
	"share_price" real DEFAULT 1 NOT NULL,
	"total_shares" real DEFAULT 1000 NOT NULL,
	"is_listed" integer DEFAULT false NOT NULL,
	"unclaimed_btc" real DEFAULT 0 NOT NULL,
	"last_mining_update_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "companies_name_unique" UNIQUE("name"),
	CONSTRAINT "companies_ticker_unique" UNIQUE("ticker"),
	FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE TABLE IF NOT EXISTS "company_members" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "company_user_idx" ON "company_members" ("company_id","user_id");`,
`CREATE TABLE IF NOT EXISTS "company_shares" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"quantity" real NOT NULL,
	"avg_cost" real DEFAULT 0 NOT NULL,
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "company_user_shares_idx" ON "company_shares" ("company_id","user_id");`,
`CREATE TABLE IF NOT EXISTS "company_holdings" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"company_id" integer NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"quantity" real NOT NULL,
	"avg_cost" real NOT NULL,
	"updated_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "company_holdings_ticker_idx" ON "company_holdings" ("company_id","ticker");`,
`CREATE TABLE IF NOT EXISTS "company_mining_rigs" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"company_id" integer NOT NULL,
	"rig_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE UNIQUE INDEX IF NOT EXISTS "company_rig_idx" ON "company_mining_rigs" ("company_id","rig_id");`,
`CREATE TABLE IF NOT EXISTS "company_transactions" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"company_id" integer NOT NULL,
	"type" text NOT NULL,
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"quantity" real NOT NULL,
	"price" real NOT NULL,
	"value" real NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE TABLE IF NOT EXISTS "automatic_orders" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" integer NOT NULL,
	"holding_id" integer NOT NULL,
	"type" text NOT NULL,
	"trigger_price" real NOT NULL,
	"quantity" real NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" integer DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON UPDATE no action ON DELETE cascade
);`,
`CREATE INDEX IF NOT EXISTS "auto_order_user_holding_idx" ON "automatic_orders" ("user_id","holding_id");`
];

export function initializeDatabase(db: Database) {
    // Use a transaction to ensure all tables are created successfully.
    const createAllTables = db.transaction(() => {
        for (const table of tables) {
            db.prepare(table).run();
        }
    });

    try {
        createAllTables();
        console.log("Database initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize database:", error);
    }
}
