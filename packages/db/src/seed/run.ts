import { sql } from 'drizzle-orm';
import { parseDecimal, colorFromSeed } from '@alvora/shared';
import { createDb } from '../index.js';
import { assets, chainBlocks, engineState } from '../schema.js';
import { SEED_ASSETS } from './assets.js';

/**
 * Idempotent seed. Re-running it adds assets introduced since the last run and
 * refreshes descriptions, but never resets a price a live market has moved.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const { sql: pg, db } = createDb({ url, max: 1, connectTimeoutSeconds: 30 });

  const rows = SEED_ASSETS.map((asset) => {
    const price = parseDecimal(asset.price);
    return {
      ticker: asset.ticker,
      name: asset.name,
      assetClass: asset.assetClass,
      description: asset.description,
      price,
      anchorPrice: price,
      previousClose: price,
      high24h: price,
      low24h: price,
      volume24h: 0n,
      circulatingSupply: asset.circulatingSupply ? parseDecimal(asset.circulatingSupply) : null,
      marketCap: asset.circulatingSupply
        ? (parseDecimal(asset.circulatingSupply) * price) / 100_000_000n
        : null,
      sigmaBps: asset.sigmaBps ?? null,
      driftBps: asset.driftBps ?? null,
      chain: asset.chain ?? null,
      companyId: null,
      isTradable: true,
      hasOrderBook: true,
      logoSeed: colorFromSeed(asset.ticker),
    };
  });

  await db
    .insert(assets)
    .values(rows)
    .onConflictDoUpdate({
      target: assets.ticker,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        assetClass: sql`excluded.asset_class`,
        anchorPrice: sql`excluded.anchor_price`,
        circulatingSupply: sql`excluded.circulating_supply`,
        sigmaBps: sql`excluded.sigma_bps`,
        driftBps: sql`excluded.drift_bps`,
        chain: sql`excluded.chain`,
        logoSeed: sql`excluded.logo_seed`,
        updatedAt: sql`now()`,
      },
    });
  console.log(`[seed] ${rows.length} assets upserted.`);

  // Genesis block per chain, so mining has a height to build on.
  for (const chain of ['BTC', 'ETH', 'SOL', 'DOGE']) {
    await db
      .insert(chainBlocks)
      .values({ chain, height: 0, hash: `genesis-${chain.toLowerCase()}`, reward: 0n, networkHashrate: 0 })
      .onConflictDoNothing();
  }
  console.log('[seed] genesis blocks ready.');

  await db
    .insert(engineState)
    .values({ key: 'seed', value: { version: 2, at: new Date().toISOString() } })
    .onConflictDoUpdate({ target: engineState.key, set: { value: sql`excluded.value`, updatedAt: sql`now()` } });

  await pg.end({ timeout: 5 });
  console.log('[seed] done.');
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
