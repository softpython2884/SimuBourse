'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, holdings, transactions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '@/lib/session';

const profileUpdateSchema = z.object({
    displayName: z.string().min(3, { message: "Le nom d'utilisateur doit comporter au moins 3 caractères." }),
    phoneNumber: z.string().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export async function updateUserProfile(values: ProfileUpdateInput): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: 'Non autorisé.' };
    }

    const validatedFields = profileUpdateSchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Champs invalides.' };
    }
    
    const { displayName, phoneNumber } = validatedFields.data;

    try {
        await db.update(users)
            .set({ displayName, phoneNumber: phoneNumber || null }) // Use null for empty optional field
            .where(eq(users.id, session.id));

        revalidatePath('/profile');
        revalidatePath('/portfolio');
        return { success: 'Profil mis à jour avec succès !' };
    } catch (error) {
        console.error('Update profile error:', error);
        return { error: 'Une erreur est survenue.' };
    }
}

export async function getAuthenticatedUserProfile() {
    const session = await getSession();
    if (!session?.id) {
        return null;
    }

    try {
        const userProfile = await db.query.users.findFirst({
            where: eq(users.id, session.id),
            columns: {
                passwordHash: false, // Exclude sensitive data
            },
            with: {
                holdings: true,
                transactions: {
                    orderBy: [desc(transactions.createdAt)],
                },
                miningRigs: true,
            }
        });

        if (!userProfile) return null;

        // Drizzle returns numerics as strings, convert them back
        const formattedHoldings = userProfile.holdings.map(h => ({
            ...h,
            quantity: parseFloat(h.quantity),
            avgCost: parseFloat(h.avgCost),
            updatedAt: new Date(h.updatedAt),
        }));

        const formattedTransactions = userProfile.transactions.map(t => ({
            ...t,
            quantity: parseFloat(t.quantity),
            price: parseFloat(t.price),
            value: parseFloat(t.value),
            createdAt: new Date(t.createdAt),
            // Reformat the asset object to match the context expectation
            asset: { name: t.name, ticker: t.ticker }
        }));

        return {
            ...userProfile,
            createdAt: new Date(userProfile.createdAt),
            cash: parseFloat(userProfile.cash),
            initialCash: parseFloat(userProfile.initialCash),
            holdings: formattedHoldings,
            transactions: formattedTransactions,
            miningRigs: userProfile.miningRigs,
        };
    } catch (error) {
        console.error('getAuthenticatedUserProfile error:', error);
        return null;
    }
}


const assetSchema = z.object({
  name: z.string(),
  ticker: z.string(),
  price: z.number(),
  type: z.enum(['Stock', 'Crypto', 'Commodity', 'Forex']),
});

export async function buyAssetAction(asset: z.infer<typeof assetSchema>, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };

    const cost = asset.price * quantity;

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });

            if (!user) throw new Error("Utilisateur non trouvé.");
            
            const userCash = parseFloat(user.cash);
            if (userCash < cost) {
                throw new Error("Fonds insuffisants.");
            }

            // Deduct cash
            const newCash = userCash - cost;
            await tx.update(users).set({ cash: newCash.toFixed(2) }).where(eq(users.id, session.id));

            // Update holdings
            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });

            if (existingHolding) {
                const existingQuantity = parseFloat(existingHolding.quantity);
                const existingAvgCost = parseFloat(existingHolding.avgCost);
                const newTotalQuantity = existingQuantity + quantity;
                const newAvgCost = ((existingAvgCost * existingQuantity) + cost) / newTotalQuantity;

                await tx.update(holdings)
                    .set({ quantity: newTotalQuantity.toString(), avgCost: newAvgCost.toString(), updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity: quantity.toString(),
                    avgCost: asset.price.toString(),
                });
            }

            // Record transaction
            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Buy',
                ticker: asset.ticker,
                name: asset.name,
                quantity: quantity.toString(),
                price: asset.price.toString(),
                value: cost.toFixed(2),
            });
            
            return { success: `Achat de ${quantity} ${asset.ticker} réussi !` };
        });

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}

export async function sellAssetAction(asset: z.infer<typeof assetSchema>, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    
    const proceeds = asset.price * quantity;

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });

            if (!user) throw new Error("Utilisateur non trouvé.");

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });
            
            const holdingQuantity = parseFloat(existingHolding?.quantity || '0');
            if (!existingHolding || holdingQuantity < quantity) {
                throw new Error("Quantité d'actifs insuffisante pour la vente.");
            }

            // Add cash
            const newCash = parseFloat(user.cash) + proceeds;
            await tx.update(users).set({ cash: newCash.toFixed(2) }).where(eq(users.id, session.id));

            // Update holdings
            const newQuantity = holdingQuantity - quantity;
            if (newQuantity > 1e-9) { // Use a small epsilon for float comparison
                await tx.update(holdings)
                    .set({ quantity: newQuantity.toString(), updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                await tx.delete(holdings).where(eq(holdings.id, existingHolding.id));
            }

            // Record transaction
            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Sell',
                ticker: asset.ticker,
                name: asset.name,
                quantity: quantity.toString(),
                price: asset.price.toString(),
                value: proceeds.toFixed(2),
            });
            
            return { success: `Vente de ${quantity} ${asset.ticker} réussie !` };
        });

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la vente." };
    }
}

export async function claimMiningRewards(amountBtc: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    if (amountBtc <= 0) return { error: 'Aucune récompense à réclamer.' };

    try {
        const result = await db.transaction(async (tx) => {
            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, 'BTC')),
            });

            if (existingHolding) {
                const newQuantity = parseFloat(existingHolding.quantity) + amountBtc;
                await tx.update(holdings)
                    .set({ quantity: newQuantity.toString(), updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                // If the user has no BTC, create a new holding.
                // Mined crypto has no cost basis in this simulation, so avgCost is 0.
                await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: 'BTC',
                    name: 'Bitcoin',
                    type: 'Crypto',
                    quantity: amountBtc.toString(),
                    avgCost: '0', 
                });
            }

            return { success: `Vous avez réclamé ${amountBtc.toFixed(8)} BTC.` };
        });

        revalidatePath('/portfolio');
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}
