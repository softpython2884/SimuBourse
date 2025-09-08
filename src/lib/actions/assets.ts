'use server';

import { db } from '@/lib/db';
import { assets as assetsSchema } from '@/lib/db/schema';
import { assets as initialAssets } from '@/lib/assets';
import { sql } from 'drizzle-orm';


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
            return (await db.query.assets.findMany()).map(a => ({...a, price: parseFloat(a.price)}));
        }

        return assetsInDb.map(a => ({...a, price: parseFloat(a.price)}));

    } catch (error) {
        console.error("Error getting assets:", error);
        return [];
    }
}

export type AssetFromDb = Awaited<ReturnType<typeof getAssets>>[0];


export async function updateAllAssetPrices() {
    try {
        const assets = await db.query.assets.findMany();
        const updatePromises = assets.map(asset => {
            const volatility = asset.type === 'Crypto' || asset.type === 'Forex' ? 0.015 : 0.005;
            const changeFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
            let newPrice = parseFloat(asset.price) * changeFactor;

            if (isNaN(newPrice) || !isFinite(newPrice) || newPrice <= 0) {
                newPrice = parseFloat(asset.price); 
            }
            
            // For now, change24h is not updated by this function. It would require storing historical data.
            return db.update(assetsSchema)
                .set({ price: newPrice.toString() })
                .where(sql`${assetsSchema.ticker} = ${asset.ticker}`);
        });

        await Promise.all(updatePromises);
        return { success: true };
    } catch (error) {
        console.error("Error updating asset prices:", error);
        return { success: false, error: "Failed to update prices." };
    }
}
