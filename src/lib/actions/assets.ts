'use server';

import { db } from '@/lib/db';
import { assets as assetsSchema } from '@/lib/db/schema';
import { assets as initialAssets } from '@/lib/assets';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// This function now gets assets from the DB and seeds it on the first run.
export async function getAssets() {
    try {
        const assetsInDb = await db.query.assets.findMany();
        if (assetsInDb.length === 0) {
            console.log("Seeding database with initial assets...");
            const assetsToInsert = initialAssets.map(asset => ({
                ...asset,
                price: asset.price.toString(),
            }));
            await db.insert(assetsSchema).values(assetsToInsert);
            const seededAssets = await db.query.assets.findMany();
            return seededAssets.map(a => ({...a, price: parseFloat(a.price)}));
        }

        return assetsInDb.map(a => ({...a, price: parseFloat(a.price)}));
    } catch (error) {
        console.error("Error getting assets:", error);
        return [];
    }
}

export type AssetFromDb = Awaited<ReturnType<typeof getAssets>>[0];

const parseMarketCap = (mc: string): number => {
    if (!mc || typeof mc !== 'string') return 0;
    const value = parseFloat(mc.replace(/[^0-9.]/g, ''));
    if (mc.toLowerCase().includes('t')) return value * 1e12;
    if (mc.toLowerCase().includes('b')) return value * 1e9;
    if (mc.toLowerCase().includes('m')) return value * 1e6;
    return value;
};

// Internal function for other server actions to update prices
export async function updatePriceFromTrade(ticker: string, tradeValue: number) {
    try {
        const asset = await db.query.assets.findFirst({
            where: eq(assetsSchema.ticker, ticker),
        });

        if (!asset) return;

        const marketCap = parseMarketCap(asset.marketCap);
        if (marketCap === 0) return;

        const IMPACT_CONSTANT = 0.05; 
        const impactPercentage = (tradeValue / marketCap) * IMPACT_CONSTANT;
        
        const currentPrice = parseFloat(asset.price);
        const newPrice = currentPrice * (1 + impactPercentage);

        await db.update(assetsSchema)
            .set({ price: newPrice.toString() })
            .where(eq(assetsSchema.ticker, ticker));
        
        // Revalidate paths that display asset prices
        revalidatePath('/trading', 'layout');
        revalidatePath('/portfolio');
        revalidatePath('/');
        revalidatePath('/companies', 'layout');

    } catch (error) {
        console.error(`Error updating price for ${ticker}:`, error);
    }
}
