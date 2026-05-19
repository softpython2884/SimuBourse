'use server';

import { db } from '@/lib/db';
import { assets as assetsSchema } from '@/lib/db/schema';
import { assets as initialAssets } from '@/lib/assets';
import { startPriceSimulator } from '@/lib/price-simulator';

// Returns the canonical asset list from the DB. Kicks off the server-side
// price simulator on first call so prices start moving without waiting on
// an SSE client to connect.
export async function getAssets() {
    try {
        // Side-effect: ensure the simulator is running.
        // We don't await here to avoid blocking the response.
        void startPriceSimulator();

        const assetsInDb = await db.query.assets.findMany();
        if (assetsInDb.length === 0) {
            console.log("Seeding database with initial assets...");
            await db.insert(assetsSchema).values(initialAssets);
            return await db.query.assets.findMany();
        }
        return assetsInDb;
    } catch (error) {
        console.error("Error getting assets:", error);
        return [];
    }
}

export type AssetFromDb = Awaited<ReturnType<typeof getAssets>>[0];
