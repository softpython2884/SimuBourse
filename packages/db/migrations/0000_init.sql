CREATE TABLE "address_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" varchar(48) NOT NULL,
	"chain" varchar(12) NOT NULL,
	"address" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"ticker" varchar(12) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"asset_class" varchar(16) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" numeric(40, 0) NOT NULL,
	"anchor_price" numeric(40, 0) NOT NULL,
	"previous_close" numeric(40, 0) NOT NULL,
	"high_24h" numeric(40, 0) DEFAULT 0 NOT NULL,
	"low_24h" numeric(40, 0) DEFAULT 0 NOT NULL,
	"volume_24h" numeric(40, 0) DEFAULT 0 NOT NULL,
	"circulating_supply" numeric(40, 0),
	"market_cap" numeric(40, 0),
	"sigma_bps" integer,
	"drift_bps" integer,
	"company_id" integer,
	"chain" varchar(12),
	"is_tradable" boolean DEFAULT true NOT NULL,
	"has_order_book" boolean DEFAULT true NOT NULL,
	"logo_seed" varchar(32) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" varchar(32),
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" varchar(64),
	"metadata" jsonb,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candles" (
	"ticker" varchar(12) NOT NULL,
	"interval" varchar(4) NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"open" numeric(40, 0) NOT NULL,
	"high" numeric(40, 0) NOT NULL,
	"low" numeric(40, 0) NOT NULL,
	"close" numeric(40, 0) NOT NULL,
	"volume" numeric(40, 0) DEFAULT 0 NOT NULL,
	"trades" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "candles_ticker_interval_bucket_pk" PRIMARY KEY("ticker","interval","bucket")
);
--> statement-breakpoint
CREATE TABLE "chain_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain" varchar(12) NOT NULL,
	"height" integer NOT NULL,
	"hash" varchar(64) NOT NULL,
	"network_hashrate" real DEFAULT 0 NOT NULL,
	"reward" numeric(40, 0) DEFAULT 0 NOT NULL,
	"mined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chain_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" varchar(64) NOT NULL,
	"chain" varchar(12) NOT NULL,
	"from_address" varchar(80) NOT NULL,
	"to_address" varchar(80) NOT NULL,
	"from_wallet_id" integer,
	"to_wallet_id" integer,
	"amount" numeric(40, 0) NOT NULL,
	"fee" numeric(40, 0) DEFAULT 0 NOT NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"required_confirmations" integer NOT NULL,
	"block_height" integer,
	"kind" varchar(12) DEFAULT 'transfer' NOT NULL,
	"memo" varchar(140),
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room" varchar(32) NOT NULL,
	"user_id" integer,
	"display_name" varchar(32) NOT NULL,
	"body" varchar(500) NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"name_key" varchar(64) NOT NULL,
	"ticker" varchar(8) NOT NULL,
	"industry" varchar(24) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_color" varchar(7) DEFAULT '#5b8def' NOT NULL,
	"founder_id" integer,
	"treasury" numeric(40, 0) DEFAULT 0 NOT NULL,
	"locked_treasury" numeric(40, 0) DEFAULT 0 NOT NULL,
	"total_shares" numeric(40, 0) DEFAULT 0 NOT NULL,
	"float_shares" numeric(40, 0) DEFAULT 0 NOT NULL,
	"treasury_shares" numeric(40, 0) DEFAULT 0 NOT NULL,
	"share_price" numeric(40, 0) DEFAULT 0 NOT NULL,
	"is_listed" boolean DEFAULT false NOT NULL,
	"listed_at" timestamp with time zone,
	"last_dividend_at" timestamp with time zone,
	"last_revenue_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revenue_30d" numeric(40, 0) DEFAULT 0 NOT NULL,
	"expenses_30d" numeric(40, 0) DEFAULT 0 NOT NULL,
	"dividends_paid" numeric(40, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(40, 0),
	"actor_id" integer,
	"actor_name" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(12) NOT NULL,
	"salary" numeric(40, 0) DEFAULT 0 NOT NULL,
	"last_paid_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"locked_quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"average_cost" numeric(40, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dividends" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"total_amount" numeric(40, 0) NOT NULL,
	"per_share" numeric(40, 0) NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"declared_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engine_state" (
	"key" varchar(40) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"ticker" varchar(12) NOT NULL,
	"quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"locked_quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"average_cost" numeric(40, 0) DEFAULT 0 NOT NULL,
	"realized_pnl" numeric(40, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"amount" numeric(40, 0) NOT NULL,
	"balance_after" numeric(40, 0) NOT NULL,
	"ticker" varchar(12),
	"quantity" numeric(40, 0),
	"price" numeric(40, 0),
	"description" text DEFAULT '' NOT NULL,
	"counterparty_kind" varchar(8),
	"counterparty_id" integer,
	"ref_type" varchar(24),
	"ref_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"principal" numeric(40, 0) NOT NULL,
	"outstanding" numeric(40, 0) NOT NULL,
	"interest_accrued" numeric(40, 0) DEFAULT 0 NOT NULL,
	"apr_bps" integer NOT NULL,
	"term_days" integer NOT NULL,
	"status" varchar(12) DEFAULT 'active' NOT NULL,
	"last_accrued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"ip" varchar(64) NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_id" integer NOT NULL,
	"outcome_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(40, 0) NOT NULL,
	"payout" numeric(40, 0) DEFAULT 0 NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(12),
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"sentiment" varchar(10) NOT NULL,
	"magnitude" varchar(10) NOT NULL,
	"impact_bps" integer NOT NULL,
	"source" varchar(10) DEFAULT 'engine' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"pool" numeric(40, 0) DEFAULT 0 NOT NULL,
	"bet_count" integer DEFAULT 0 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mining_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"chain" varchar(12) NOT NULL,
	"block_height" integer NOT NULL,
	"hashrate" real NOT NULL,
	"share_ppm" bigint NOT NULL,
	"reward" numeric(40, 0) NOT NULL,
	"electricity_cost" numeric(40, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mining_rigs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"rig_id" varchar(40) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_paid" numeric(40, 0) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "net_worth_history" (
	"user_id" integer NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"net_worth" numeric(40, 0) NOT NULL,
	"cash" numeric(40, 0) NOT NULL,
	"holdings_value" numeric(40, 0) NOT NULL,
	CONSTRAINT "net_worth_history_user_id_bucket_pk" PRIMARY KEY("user_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(140) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" varchar(200),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" varchar(12) NOT NULL,
	"side" varchar(4) NOT NULL,
	"type" varchar(16) NOT NULL,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"time_in_force" varchar(4) DEFAULT 'gtc' NOT NULL,
	"quantity" numeric(40, 0) NOT NULL,
	"filled_quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"limit_price" numeric(40, 0),
	"stop_price" numeric(40, 0),
	"trail_percent" numeric(40, 0),
	"trail_anchor" numeric(40, 0),
	"reserved_cash" numeric(40, 0) DEFAULT 0 NOT NULL,
	"reserved_quantity" numeric(40, 0) DEFAULT 0 NOT NULL,
	"average_price" numeric(40, 0) DEFAULT 0 NOT NULL,
	"fee_paid" numeric(40, 0) DEFAULT 0 NOT NULL,
	"reject_reason" text,
	"client_order_id" varchar(64),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otc_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"maker_id" integer NOT NULL,
	"offer_ticker" varchar(12) NOT NULL,
	"offer_quantity" numeric(40, 0) NOT NULL,
	"want_ticker" varchar(12),
	"want_quantity" numeric(40, 0),
	"want_cash" numeric(40, 0),
	"target_user_id" integer,
	"taker_id" integer,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_markets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" varchar(48) NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"total_pool" numeric(40, 0) DEFAULT 0 NOT NULL,
	"winning_outcome_id" integer,
	"creator_id" integer,
	"creator_name" varchar(32) NOT NULL,
	"closing_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ticker" varchar(12) NOT NULL,
	"direction" varchar(6) NOT NULL,
	"price" numeric(40, 0) NOT NULL,
	"triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"replaced_by_id" integer,
	"revoked_at" timestamp with time zone,
	"user_agent" varchar(256),
	"ip" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakes" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"chain" varchar(12) NOT NULL,
	"amount" numeric(40, 0) NOT NULL,
	"apy_bps" integer NOT NULL,
	"reward_accrued" numeric(40, 0) DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"last_accrued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlocks_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(12) NOT NULL,
	"price" numeric(40, 0) NOT NULL,
	"quantity" numeric(40, 0) NOT NULL,
	"value" numeric(40, 0) NOT NULL,
	"buy_order_id" integer,
	"sell_order_id" integer,
	"buyer_kind" varchar(8),
	"buyer_id" integer,
	"seller_kind" varchar(8),
	"seller_id" integer,
	"buyer_fee" numeric(40, 0) DEFAULT 0 NOT NULL,
	"seller_fee" numeric(40, 0) DEFAULT 0 NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"taker_side" varchar(4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" integer NOT NULL,
	"achievement_id" varchar(40) NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"display_name_key" varchar(32) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"cash" numeric(40, 0) DEFAULT 0 NOT NULL,
	"locked_cash" numeric(40, 0) DEFAULT 0 NOT NULL,
	"initial_cash" numeric(40, 0) DEFAULT 0 NOT NULL,
	"realized_pnl" numeric(40, 0) DEFAULT 0 NOT NULL,
	"bio" text,
	"avatar_color" varchar(7) DEFAULT '#5b8def' NOT NULL,
	"is_portfolio_public" boolean DEFAULT true NOT NULL,
	"locale" varchar(8) DEFAULT 'fr' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_daily_bonus_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_kind" varchar(8) NOT NULL,
	"owner_id" integer NOT NULL,
	"chain" varchar(12) NOT NULL,
	"address" varchar(80) NOT NULL,
	"label" varchar(48) DEFAULT '' NOT NULL,
	"balance" numeric(40, 0) DEFAULT 0 NOT NULL,
	"pending_balance" numeric(40, 0) DEFAULT 0 NOT NULL,
	"locked_balance" numeric(40, 0) DEFAULT 0 NOT NULL,
	"staked_balance" numeric(40, 0) DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"user_id" integer NOT NULL,
	"ticker" varchar(12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_id_ticker_pk" PRIMARY KEY("user_id","ticker")
);
--> statement-breakpoint
ALTER TABLE "address_book" ADD CONSTRAINT "address_book_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candles" ADD CONSTRAINT "candles_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_founder_id_users_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_shares" ADD CONSTRAINT "company_shares_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_shares" ADD CONSTRAINT "company_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dividends" ADD CONSTRAINT "dividends_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_bets" ADD CONSTRAINT "market_bets_market_id_prediction_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."prediction_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_bets" ADD CONSTRAINT "market_bets_outcome_id_market_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."market_outcomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_bets" ADD CONSTRAINT "market_bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_outcomes" ADD CONSTRAINT "market_outcomes_market_id_prediction_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."prediction_markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_history" ADD CONSTRAINT "net_worth_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otc_offers" ADD CONSTRAINT "otc_offers_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_markets" ADD CONSTRAINT "prediction_markets_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_ticker_assets_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."assets"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "address_book_key" ON "address_book" USING btree ("user_id","chain","address");--> statement-breakpoint
CREATE INDEX "assets_class_idx" ON "assets" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "assets_tradable_idx" ON "assets" USING btree ("is_tradable");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_company_key" ON "assets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_log" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "candles_lookup_idx" ON "candles" USING btree ("ticker","interval","bucket" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "chain_blocks_key" ON "chain_blocks" USING btree ("chain","height");--> statement-breakpoint
CREATE INDEX "chain_blocks_time_idx" ON "chain_blocks" USING btree ("chain","mined_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "chain_tx_hash_key" ON "chain_transactions" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "chain_tx_from_idx" ON "chain_transactions" USING btree ("from_wallet_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chain_tx_to_idx" ON "chain_transactions" USING btree ("to_wallet_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chain_tx_pending_idx" ON "chain_transactions" USING btree ("status","chain");--> statement-breakpoint
CREATE INDEX "chat_room_idx" ON "chat_messages" USING btree ("room","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "companies_name_key" ON "companies" USING btree ("name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_ticker_key" ON "companies" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "companies_listed_idx" ON "companies" USING btree ("is_listed");--> statement-breakpoint
CREATE INDEX "companies_founder_idx" ON "companies" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "company_events_idx" ON "company_events" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_key" ON "company_members" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_members_user_idx" ON "company_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_shares_key" ON "company_shares" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "company_shares_user_idx" ON "company_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dividends_company_idx" ON "dividends" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_owner_ticker_key" ON "holdings" USING btree ("owner_kind","owner_id","ticker");--> statement-breakpoint
CREATE INDEX "holdings_ticker_idx" ON "holdings" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "ledger_owner_idx" ON "ledger" USING btree ("owner_kind","owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ledger_kind_idx" ON "ledger" USING btree ("kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "loans_accrual_idx" ON "loans" USING btree ("status","last_accrued_at");--> statement-breakpoint
CREATE INDEX "login_attempts_lookup_idx" ON "login_attempts" USING btree ("email","ip","created_at");--> statement-breakpoint
CREATE INDEX "market_bets_user_idx" ON "market_bets" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "market_bets_outcome_idx" ON "market_bets" USING btree ("outcome_id");--> statement-breakpoint
CREATE INDEX "market_events_ticker_idx" ON "market_events" USING btree ("ticker","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "market_events_expiry_idx" ON "market_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "market_outcomes_idx" ON "market_outcomes" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "mining_rewards_owner_idx" ON "mining_rewards" USING btree ("owner_kind","owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "mining_rigs_key" ON "mining_rigs" USING btree ("owner_kind","owner_id","rig_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","is_read","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_book_idx" ON "orders" USING btree ("ticker","status","side","limit_price","created_at");--> statement-breakpoint
CREATE INDEX "orders_owner_idx" ON "orders" USING btree ("owner_kind","owner_id","status");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_trigger_idx" ON "orders" USING btree ("status","type");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_client_id_key" ON "orders" USING btree ("user_id","client_order_id");--> statement-breakpoint
CREATE INDEX "otc_status_idx" ON "otc_offers" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "otc_maker_idx" ON "otc_offers" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "prediction_status_idx" ON "prediction_markets" USING btree ("status","closing_at");--> statement-breakpoint
CREATE INDEX "prediction_creator_idx" ON "prediction_markets" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "price_alerts_active_idx" ON "price_alerts" USING btree ("ticker","triggered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stakes_wallet_idx" ON "stakes" USING btree ("wallet_id","status");--> statement-breakpoint
CREATE INDEX "stakes_accrual_idx" ON "stakes" USING btree ("status","last_accrued_at");--> statement-breakpoint
CREATE INDEX "trades_ticker_idx" ON "trades" USING btree ("ticker","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_buyer_idx" ON "trades" USING btree ("buyer_kind","buyer_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_seller_idx" ON "trades" USING btree ("seller_kind","seller_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_display_name_key" ON "users" USING btree ("display_name_key");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_address_key" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_owner_chain_key" ON "wallets" USING btree ("owner_kind","owner_id","chain");