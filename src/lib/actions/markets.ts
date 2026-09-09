'use server';

import { db } from '@/lib/db';
import { runTransaction } from '@/lib/db/tx';
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
        const marketsToCreate = AI_MARKET_COUNT - count;
        if (marketsToCreate <= 0) return;

        console.log(`Creating ${marketsToCreate} new AI markets...`);
        const themes = ['finance', 'tech', 'geopolitics', 'crypto'];

        for (let i = 0; i < marketsToCreate; i++) {
            const theme = themes[i % themes.length];
            const marketData = await createPredictionMarket({ theme });

            const closingInDays = Math.floor(Math.random() * 12) + 3;
            const closingAt = new Date();
            closingAt.setDate(closingAt.getDate() + closingInDays);

            const startingPool = Math.random() * 2000 + 500;
            const randomWeights = marketData.outcomes.map(() => Math.random());
            const totalWeight = randomWeights.reduce((s, w) => s + w, 0);
            const outcomePools = randomWeights.map(w => (w / totalWeight) * startingPool);

            // Two sequential inserts (better-sqlite3 v11 rejects async transaction callbacks).
            // Not strictly atomic, but AI markets are decorative — partial failures are
            // logged and skipped without breaking the page.
            const [newMarket] = await db.insert(predictionMarkets).values({
                title: marketData.title,
                category: marketData.category,
                closingAt,
                creatorDisplayName: AI_CREATOR_NAME,
                totalPool: startingPool,
            }).returning();

            await db.insert(marketOutcomes).values(
                marketData.outcomes.map((outcomeName, index) => ({
                    marketId: newMarket.id,
                    name: outcomeName,
                    pool: outcomePools[index],
                }))
            );
        }
        revalidatePath('/markets');
    } catch (error) {
        console.error("Error ensuring AI markets:", error);
    }
}

export async function getOpenMarkets() {
    return await db.query.predictionMarkets.findMany({
        where: eq(predictionMarkets.status, 'open'),
        with: { outcomes: true },
        orderBy: [desc(predictionMarkets.createdAt)],
    });
}
export type MarketWithOutcomes = Awaited<ReturnType<typeof getOpenMarkets>>[0];

const marketFormSchema = z.object({
    title: z.string().min(10).max(100),
    category: z.string().min(3).max(50),
    outcomes: z.array(z.object({ name: z.string().min(1).max(100) })).min(2).max(5),
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

    if (closingDate.getTime() < Date.now() + 60_000) {
        return { error: "La date de clôture doit être dans le futur." };
    }

    try {
        await runTransaction(async (tx) => {
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

const placeBetSchema = z.object({
    outcomeId: z.number().int().positive(),
    marketId: z.number().int().positive(),
    amount: z.number().positive().finite().max(1e12),
});

export async function placeBet(outcomeId: number, marketId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté pour parier." };

    const parsed = placeBetSchema.safeParse({ outcomeId, marketId, amount });
    if (!parsed.success) return { error: "Données invalides." };

    try {
        const result = await runTransaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true },
            });
            if (!user) throw new Error("Utilisateur non trouvé.");
            if (user.cash < parsed.data.amount) throw new Error("Fonds insuffisants.");

            // Validate that outcome belongs to market and market is still open.
            const market = await tx.query.predictionMarkets.findFirst({
                where: eq(predictionMarkets.id, parsed.data.marketId),
                columns: { status: true, closingAt: true },
            });
            if (!market) throw new Error("Marché introuvable.");
            if (market.status !== 'open') throw new Error("Ce marché n'est plus ouvert aux paris.");
            if (new Date(market.closingAt).getTime() < Date.now()) throw new Error("Ce marché est expiré.");

            const outcome = await tx.query.marketOutcomes.findFirst({
                where: and(eq(marketOutcomes.id, parsed.data.outcomeId), eq(marketOutcomes.marketId, parsed.data.marketId)),
            });
            if (!outcome) throw new Error("Issue de marché invalide.");

            await tx.update(users).set({ cash: sql`cash - ${parsed.data.amount}` }).where(eq(users.id, session.id));
            await tx.update(marketOutcomes).set({ pool: sql`pool + ${parsed.data.amount}` }).where(eq(marketOutcomes.id, parsed.data.outcomeId));
            await tx.update(predictionMarkets).set({ totalPool: sql`total_pool + ${parsed.data.amount}` }).where(eq(predictionMarkets.id, parsed.data.marketId));

            await tx.insert(marketBets).values({
                userId: session.id,
                outcomeId: parsed.data.outcomeId,
                amount: parsed.data.amount,
            });

            return { success: "Pari placé avec succès !" };
        });

        revalidatePath('/markets');
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors du placement du pari." };
    }
}

const resolveSchema = z.object({
    marketId: z.number().int().positive(),
    winningOutcomeId: z.number().int().positive(),
});

// Admin-only: declare the winning outcome of a closed market.
// The cron resolver then settles it (pays out winners proportionally).
export async function setMarketWinner(marketId: number, winningOutcomeId: number): Promise<{ success?: string; error?: string }> {
    const { requireAdmin } = await import('@/lib/session');
    try {
        await requireAdmin();

        const parsed = resolveSchema.safeParse({ marketId, winningOutcomeId });
        if (!parsed.success) return { error: "Données invalides." };

        await runTransaction(async (tx) => {
            const outcome = await tx.query.marketOutcomes.findFirst({
                where: and(eq(marketOutcomes.id, parsed.data.winningOutcomeId), eq(marketOutcomes.marketId, parsed.data.marketId)),
            });
            if (!outcome) throw new Error("Issue invalide pour ce marché.");

            await tx.update(predictionMarkets).set({
                winningOutcomeId: parsed.data.winningOutcomeId,
                status: 'closed',
            }).where(eq(predictionMarkets.id, parsed.data.marketId));
        });

        revalidatePath('/markets');
        revalidatePath('/admin');
        return { success: "Issue gagnante définie. Le marché sera réglé sous peu." };
    } catch (error: any) {
        return { error: error.message || "Erreur lors de la définition de l'issue." };
    }
}
