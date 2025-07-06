'use server';

import { db } from '@/lib/db';
import { assets as assetsSchema } from '@/lib/db/schema';
import { assets as initialAssets } from '@/lib/assets';

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
            return (await db.query.assets.findMany()).map(a => ({...a, price: parseFloat(a.price)}));
        }

        return assetsInDb.map(a => ({...a, price: parseFloat(a.price)}));

    } catch (error) {
        console.error("Error getting assets:", error);
        return [];
    }
}

export type AssetFromDb = Awaited<ReturnType<typeof getAssets>>[0];
