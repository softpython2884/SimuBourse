

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, holdings, transactions, assets as assetsSchema, automaticOrders } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { getRigById } from '../mining';

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
                companyShares: { // Fetch company shares
                    with: {
                        company: true
                    }
                }
            }
        });

        if (!userProfile) return null;

        const totalHashRateMhs = userProfile.miningRigs.reduce((total, rig) => {
            const rigData = getRigById(rig.rigId);
            return total + (rigData?.hashRateMhs || 0) * rig.quantity;
        }, 0);

        let finalUnclaimedBtc = parseFloat(userProfile.unclaimedBtc as any);

        if (totalHashRateMhs > 0) {
            const now = new Date();
            const lastUpdate = new Date(userProfile.lastMiningUpdateAt);
            const secondsElapsed = (now.getTime() - lastUpdate.getTime()) / 1000;
            
            if (secondsElapsed > 1) {
                const BTC_PER_MHS_PER_SECOND = 7.7e-12;
                const earnedOffline = totalHashRateMhs * BTC_PER_MHS_PER_SECOND * secondsElapsed;
                finalUnclaimedBtc += earnedOffline;
                
                await db.update(users)
                  .set({ unclaimedBtc: finalUnclaimedBtc, lastMiningUpdateAt: now })
                  .where(eq(users.id, session.id));
            }
        }
        
        const regularHoldings = userProfile.holdings.map(h => ({
            ...h,
            quantity: parseFloat(h.quantity as any),
            avgCost: parseFloat(h.avgCost as any),
            isCompanyShare: false,
            updatedAt: new Date(h.updatedAt),
            company: null,
        }));

        const companyShareHoldings = userProfile.companyShares.map(cs => {
            return {
                id: cs.id, // Using the share ID now
                userId: cs.userId,
                ticker: cs.company.ticker,
                name: cs.company.name,
                type: 'Company Share' as const,
                isCompanyShare: true,
                quantity: parseFloat(cs.quantity as any),
                avgCost: parseFloat(cs.avgCost as any),
                updatedAt: new Date(cs.company.createdAt),
                company: {
                    ...cs.company,
                    cash: parseFloat(cs.company.cash as any),
                    totalShares: parseFloat(cs.company.totalShares as any),
                    sharePrice: parseFloat(cs.company.sharePrice as any),
                },
            };
        });

        const allHoldings = [...regularHoldings, ...companyShareHoldings];

        const formattedTransactions = userProfile.transactions.map(t => ({
            ...t,
            quantity: parseFloat(t.quantity as any),
            price: parseFloat(t.price as any),
            value: parseFloat(t.value as any),
            createdAt: new Date(t.createdAt),
            asset: { name: t.name, ticker: t.ticker }
        }));

        return {
            ...userProfile,
            cash: parseFloat(userProfile.cash as any),
            initialCash: parseFloat(userProfile.initialCash as any),
            createdAt: new Date(userProfile.createdAt),
            unclaimedBtc: finalUnclaimedBtc,
            holdings: allHoldings,
            transactions: formattedTransactions,
            miningRigs: userProfile.miningRigs,
        };
    } catch (error) {
        console.error('getAuthenticatedUserProfile error:', error);
        return null;
    }
}


export async function buyAssetAction(ticker: string, quantity: number, stopLoss?: number, takeProfit?: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    
    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) {
                throw new Error("Utilisateur non trouvé.");
            }
            
            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
            if (!asset) {
                 throw new Error("Actif non trouvé.");
            }
            
            const currentPrice = parseFloat(asset.price as any);
            const tradeValue = currentPrice * quantity;

            if (parseFloat(user.cash as any) < tradeValue) {
                throw new Error("Fonds insuffisants.");
            }
            
            await tx.update(users).set({ cash: (parseFloat(user.cash as any) - tradeValue) }).where(eq(users.id, session.id));

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });

            let holdingId: number;
            if (existingHolding) {
                const existingQuantity = parseFloat(existingHolding.quantity as any);
                const existingAvgCost = parseFloat(existingHolding.avgCost as any);
                const newTotalQuantity = existingQuantity + quantity;
                const newAvgCost = ((existingAvgCost * existingQuantity) + tradeValue) / newTotalQuantity;
                await tx.update(holdings).set({ quantity: newTotalQuantity, avgCost: newAvgCost, updatedAt: new Date() }).where(eq(holdings.id, existingHolding.id));
                holdingId = existingHolding.id;
            } else {
                const [newHolding] = await tx.insert(holdings).values({ userId: session.id, ticker: asset.ticker, name: asset.name, type: asset.type, quantity: quantity, avgCost: currentPrice }).returning({id: holdings.id});
                holdingId = newHolding.id;
            }

            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Buy',
                ticker: ticker,
                name: asset.name,
                quantity: quantity,
                price: currentPrice,
                value: tradeValue,
            });

            // Create automatic orders if specified
            if (stopLoss) {
                await tx.insert(automaticOrders).values({
                    userId: session.id,
                    holdingId: holdingId,
                    type: 'stop-loss',
                    triggerPrice: stopLoss,
                    quantity: quantity,
                });
            }
             if (takeProfit) {
                await tx.insert(automaticOrders).values({
                    userId: session.id,
                    holdingId: holdingId,
                    type: 'take-profit',
                    triggerPrice: takeProfit,
                    quantity: quantity,
                });
            }
        });

        let successMessage = `Achat de ${quantity} ${ticker} réussi !`;
        if (stopLoss || takeProfit) {
            successMessage += " Ordres automatiques placés."
        }

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        
        return { success: successMessage };

    } catch (error: any) {
        console.error("Buy Asset Action Error:", error);
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}

export async function sellAssetAction(ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    
    try {
        await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            
            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
            if (!asset) throw new Error("Actif non trouvé.");
            
            const currentPrice = parseFloat(asset.price as any);
            const tradeValue = currentPrice * quantity;

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });
            
            const holdingQuantity = parseFloat(existingHolding?.quantity as any || '0');
            if (!existingHolding || holdingQuantity < quantity) throw new Error("Quantité d'actifs insuffisante pour la vente.");

            await tx.update(users).set({ cash: parseFloat(user.cash as any) + tradeValue }).where(eq(users.id, session.id));

            const newQuantity = holdingQuantity - quantity;
            if (newQuantity > 1e-9) { 
                await tx.update(holdings).set({ quantity: newQuantity, updatedAt: new Date() }).where(eq(holdings.id, existingHolding.id));
            } else {
                // If selling all, also cancel any associated automatic orders
                await tx.delete(automaticOrders).where(eq(automaticOrders.holdingId, existingHolding.id));
                await tx.delete(holdings).where(eq(holdings.id, existingHolding.id));
            }

            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Sell',
                ticker: ticker,
                name: asset.name,
                quantity: quantity,
                price: currentPrice,
                value: tradeValue,
            });
        });

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return { success: `Vente de ${quantity} ${ticker} réussie !` };

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la vente." };
    }
}


export async function claimMiningRewards(amountBtc: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    if (amountBtc <= 0) return { error: 'Aucune récompense à réclamer.' };

    try {
        await db.transaction(async (tx) => {
            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, 'BTC')),
            });

            if (existingHolding) {
                const newQuantity = parseFloat(existingHolding.quantity as any) + amountBtc;
                await tx.update(holdings)
                    .set({ quantity: newQuantity, updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: 'BTC',
                    name: 'Bitcoin',
                    type: 'Crypto',
                    quantity: amountBtc,
                    avgCost: 0, 
                });
            }

            await tx.update(users)
                .set({ unclaimedBtc: 0, lastMiningUpdateAt: new Date() })
                .where(eq(users.id, session.id));
        });

        revalidatePath('/portfolio');
        revalidatePath('/mining');
        return { success: `Vous avez réclamé ${amountBtc.toFixed(8)} BTC.` };
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}

    

    
