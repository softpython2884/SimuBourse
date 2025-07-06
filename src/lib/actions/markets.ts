
'use server';

import { db } from '@/lib/db';
import { predictionMarkets, marketOutcomes, users, marketBets } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createPredictionMarket } from '@/ai/flows/create-prediction-market';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const AI_MARKET_COUNT = 4;
const AI_CREATOR_NAME = "SimuBourse AI";

export async function ensureAiMarkets() {
    try {
        const openAiMarketsCountResult = await db.select({
            count: sql<number>`cast(count(*) as int)`
        }).from(predictionMarkets).where(and(
            eq(predictionMarkets.status, 'open'),
            eq(predictionMarkets.creatorDisplayName, AI_CREATOR_NAME)
        ));
        
        const count = openAiMarketsCountResult[0]?.count ?? 0;
        let marketsToCreate = AI_MARKET_COUNT - count;

        if (marketsToCreate <= 0) {
            return;
        }

        console.log(`Creating ${marketsToCreate} new AI markets...`);

        const themes = ['finance', 'tech', 'geopolitics', 'crypto'];
        for (let i = 0; i < marketsToCreate; i++) {
            const theme = themes[i % themes.length];
            const marketData = await createPredictionMarket({ theme });
            
            const closingInDays = Math.floor(Math.random() * 12) + 3; // 3 to 14 days
            const closingAt = new Date();
            closingAt.setDate(closingAt.getDate() + closingInDays);

            // Generate a random starting pot between $500 and $2500
            const startingPool = Math.random() * 2000 + 500;
            
            // Distribute the pool randomly among outcomes
            const randomWeights = marketData.outcomes.map(() => Math.random());
            const totalWeight = randomWeights.reduce((sum, weight) => sum + weight, 0);
            const outcomePools = randomWeights.map(weight => (weight / totalWeight) * startingPool);

            await db.transaction(async (tx) => {
                const [newMarket] = await tx.insert(predictionMarkets).values({
                    title: marketData.title,
                    category: marketData.category,
                    closingAt: closingAt,
                    creatorDisplayName: AI_CREATOR_NAME,
                    totalPool: startingPool.toFixed(2),
                }).returning();

                await tx.insert(marketOutcomes).values(
                    marketData.outcomes.map((outcomeName, index) => ({
                        marketId: newMarket.id,
                        name: outcomeName,
                        pool: outcomePools[index].toFixed(2),
                    }))
                );
            });
        }
        // This was causing an error because it was called during render.
        // The page is dynamic anyway, so it will get fresh data on the next request.
        // revalidatePath('/markets');
    } catch (error) {
        console.error("Error ensuring AI markets:", error);
        // Don't throw, just log the error. The page can still render with fewer markets.
    }
}

export async function getOpenMarkets() {
    const markets = await db.query.predictionMarkets.findMany({
        where: eq(predictionMarkets.status, 'open'),
        with: {
            outcomes: true,
        },
        orderBy: [desc(predictionMarkets.createdAt)]
    });

    // Convert numeric strings to numbers
    return markets.map(market => ({
        ...market,
        totalPool: parseFloat(market.totalPool),
        outcomes: market.outcomes.map(outcome => ({
            ...outcome,
            pool: parseFloat(outcome.pool)
        }))
    }));
}
export type MarketWithOutcomes = Awaited<ReturnType<typeof getOpenMarkets>>[0];

const marketFormSchema = z.object({
  title: z.string().min(10).max(100),
  category: z.string().min(3),
  outcomes: z.array(z.object({ name: z.string().min(1) })).min(2).max(5),
  closingDate: z.date(),
});

export async function createUserMarket(values: z.infer<typeof marketFormSchema>): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id || !session.displayName) {
        return { error: "Vous devez être connecté pour créer un marché." };
    }

    const validatedFields = marketFormSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: "Données invalides." };
    }
    const { title, category, outcomes, closingDate } = validatedFields.data;

    try {
        await db.transaction(async (tx) => {
            const [newMarket] = await tx.insert(predictionMarkets).values({
                title,
                category,
                closingAt: closingDate,
                creatorId: session.id,
                creatorDisplayName: session.displayName!,
            }).returning();

            await tx.insert(marketOutcomes).values(
                outcomes.map(outcome => ({
                    marketId: newMarket.id,
                    name: outcome.name,
                }))
            );
        });

        revalidatePath('/markets');
        return { success: "Marché créé avec succès !" };
    } catch (error) {
        console.error("Error creating user market:", error);
        return { error: "Une erreur est survenue lors de la création du marché." };
    }
}

export async function placeBet(outcomeId: number, marketId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: "Vous devez être connecté pour parier." };
    }
    if (amount <= 0) {
        return { error: "Le montant du pari doit être positif." };
    }

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Check user cash
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });
            if (!user || parseFloat(user.cash) < amount) {
                throw new Error("Fonds insuffisants.");
            }

            // 2. Deduct cash from user
            const newCash = parseFloat(user.cash) - amount;
            await tx.update(users).set({ cash: newCash.toFixed(2) }).where(eq(users.id, session.id));
            
            // 3. Update outcome and market pools
            await tx.update(marketOutcomes)
              .set({ pool: sql`${marketOutcomes.pool} + ${amount}`})
              .where(eq(marketOutcomes.id, outcomeId));

            await tx.update(predictionMarkets)
              .set({ totalPool: sql`${predictionMarkets.totalPool} + ${amount}`})
              .where(eq(predictionMarkets.id, marketId));

            // 4. Create the bet record
            await tx.insert(marketBets).values({
                userId: session.id,
                outcomeId: outcomeId,
                amount: amount.toFixed(2),
            });

            return { success: "Pari placé avec succès !" };
        });

        revalidatePath('/markets');
        revalidatePath('/portfolio'); // For cash update
        revalidatePath('/profile'); // For cash update
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors du placement du pari." };
    }
}
