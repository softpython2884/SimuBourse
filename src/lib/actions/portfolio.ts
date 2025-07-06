'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, holdings, transactions, assets as assetsSchema, companies, companyShares } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { getRigById } from '../mining';
import { applyMarketImpactToCompany } from './companies';

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

        // --- OFFLINE MINING CALCULATION ---
        const totalHashRateMhs = userProfile.miningRigs.reduce((total, rig) => {
            const rigData = getRigById(rig.rigId);
            return total + (rigData?.hashRateMhs || 0) * rig.quantity;
        }, 0);

        let finalUnclaimedBtc = parseFloat(userProfile.unclaimedBtc);

        if (totalHashRateMhs > 0) {
            const now = new Date();
            const lastUpdate = new Date(userProfile.lastMiningUpdateAt);
            const secondsElapsed = (now.getTime() - lastUpdate.getTime()) / 1000;
            
            if (secondsElapsed > 1) {
                const BTC_PER_MHS_PER_SECOND = 7.7e-12;
                const earnedOffline = totalHashRateMhs * BTC_PER_MHS_PER_SECOND * secondsElapsed;
                finalUnclaimedBtc += earnedOffline;
                
                await db.update(users)
                  .set({ unclaimedBtc: finalUnclaimedBtc.toString(), lastMiningUpdateAt: now })
                  .where(eq(users.id, session.id));
            }
        }
        // --- END CALCULATION ---


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
            asset: { name: t.name, ticker: t.ticker }
        }));

        return {
            ...userProfile,
            createdAt: new Date(userProfile.createdAt),
            cash: parseFloat(userProfile.cash),
            initialCash: parseFloat(userProfile.initialCash),
            unclaimedBtc: finalUnclaimedBtc,
            holdings: formattedHoldings,
            transactions: formattedTransactions,
            miningRigs: userProfile.miningRigs,
        };
    } catch (error) {
        console.error('getAuthenticatedUserProfile error:', error);
        return null;
    }
}


export async function buyAssetAction(ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    
    // Determine if it's a company or a regular asset
    const company = await db.query.companies.findFirst({
        where: and(eq(companies.ticker, ticker), eq(companies.isListed, true))
    });

    try {
        let tradeValue = 0;
        let assetName = '';
        
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });
            if (!user) throw new Error("Utilisateur non trouvé.");
            
            if (company) {
                // --- Logic for buying listed COMPANY SHARES (Secondary Market) ---
                assetName = company.name;
                const price = parseFloat(company.sharePrice);
                tradeValue = price * quantity;

                if (parseFloat(user.cash) < tradeValue) throw new Error("Fonds insuffisants.");

                // Debit user cash
                await tx.update(users).set({ cash: (parseFloat(user.cash) - tradeValue).toFixed(2) }).where(eq(users.id, session.id));

                // The company's cash and total shares are NOT affected in a secondary market trade.
                
                // Add shares to user's portfolio.
                const existingShares = await tx.query.companyShares.findFirst({
                    where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, company.id))
                });
                if (existingShares) {
                    const newQuantity = parseFloat(existingShares.quantity) + quantity;
                    await tx.update(companyShares).set({ quantity: newQuantity.toString() }).where(eq(companyShares.id, existingShares.id));
                } else {
                    await tx.insert(companyShares).values({ userId: session.id, companyId: company.id, quantity: quantity.toString() });
                }

            } else {
                // --- Logic for buying REGULAR ASSETS ---
                const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
                if (!asset) throw new Error("Actif non trouvé.");
                
                assetName = asset.name;
                const price = parseFloat(asset.price);
                tradeValue = price * quantity;

                if (parseFloat(user.cash) < tradeValue) throw new Error("Fonds insuffisants.");
                
                // Debit user
                await tx.update(users).set({ cash: (parseFloat(user.cash) - tradeValue).toFixed(2) }).where(eq(users.id, session.id));

                // Add asset to user holdings
                const existingHolding = await tx.query.holdings.findFirst({
                    where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
                });

                if (existingHolding) {
                    const existingQuantity = parseFloat(existingHolding.quantity);
                    const existingAvgCost = parseFloat(existingHolding.avgCost);
                    const newTotalQuantity = existingQuantity + quantity;
                    const newAvgCost = ((existingAvgCost * existingQuantity) + tradeValue) / newTotalQuantity;
                    await tx.update(holdings).set({ quantity: newTotalQuantity.toString(), avgCost: newAvgCost.toString(), updatedAt: new Date() }).where(eq(holdings.id, existingHolding.id));
                } else {
                    await tx.insert(holdings).values({ userId: session.id, ticker: asset.ticker, name: asset.name, type: asset.type, quantity: quantity.toString(), avgCost: price.toString() });
                }
            }

            // Create a universal transaction record
            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Buy',
                ticker: ticker,
                name: assetName,
                quantity: quantity.toString(),
                price: (tradeValue / quantity).toString(),
                value: tradeValue.toFixed(2),
            });
            
            return { success: `Achat de ${quantity} ${ticker} réussi !` };
        });

        // Apply market impact outside the transaction
        if (result.success && company) {
            await applyMarketImpactToCompany(ticker, tradeValue);
        }
        
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}

export async function sellAssetAction(ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
    
    const company = await db.query.companies.findFirst({
        where: and(eq(companies.ticker, ticker), eq(companies.isListed, true))
    });

    try {
        let tradeValue = 0;
        let assetName = '';

        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });
            if (!user) throw new Error("Utilisateur non trouvé.");
            
            if (company) {
                // --- Logic for selling listed COMPANY SHARES (Secondary Market) ---
                assetName = company.name;
                const price = parseFloat(company.sharePrice);
                tradeValue = price * quantity;

                const userShareHolding = await tx.query.companyShares.findFirst({
                    where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, company.id))
                });

                const sharesHeld = parseFloat(userShareHolding?.quantity || '0');
                if (sharesHeld < quantity) throw new Error("Vous ne possédez pas assez de parts pour cette vente.");
                
                // The company's cash is NOT affected. The money comes from the buyer (market maker).

                // Credit user
                await tx.update(users).set({ cash: (parseFloat(user.cash) + tradeValue).toFixed(2) }).where(eq(users.id, session.id));

                // Remove shares from user
                const newSharesHeld = sharesHeld - quantity;
                if (newSharesHeld < 1e-9) {
                    await tx.delete(companyShares).where(eq(companyShares.id, userShareHolding!.id));
                } else {
                    await tx.update(companyShares).set({ quantity: newSharesHeld.toString() }).where(eq(companyShares.id, userShareHolding!.id));
                }

            } else {
                // --- Logic for selling REGULAR ASSETS ---
                const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
                if (!asset) throw new Error("Actif non trouvé.");
                
                assetName = asset.name;
                const price = parseFloat(asset.price);
                tradeValue = price * quantity;

                const existingHolding = await tx.query.holdings.findFirst({
                    where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
                });
                
                const holdingQuantity = parseFloat(existingHolding?.quantity || '0');
                if (!existingHolding || holdingQuantity < quantity) throw new Error("Quantité d'actifs insuffisante pour la vente.");

                // Credit user
                await tx.update(users).set({ cash: (parseFloat(user.cash) + tradeValue).toFixed(2) }).where(eq(users.id, session.id));

                // Remove asset from holdings
                const newQuantity = holdingQuantity - quantity;
                if (newQuantity > 1e-9) { 
                    await tx.update(holdings).set({ quantity: newQuantity.toString(), updatedAt: new Date() }).where(eq(holdings.id, existingHolding.id));
                } else {
                    await tx.delete(holdings).where(eq(holdings.id, existingHolding.id));
                }
            }

            // Create a universal transaction record
            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Sell',
                ticker: ticker,
                name: assetName,
                quantity: quantity.toString(),
                price: (tradeValue / quantity).toString(),
                value: tradeValue.toFixed(2),
            });
            
            return { success: `Vente de ${quantity} ${ticker} réussie !` };
        });

        // Apply market impact outside the transaction
        if (result.success && company) {
            await applyMarketImpactToCompany(ticker, -tradeValue); // Negative value for sell impact
        }
        
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
                await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: 'BTC',
                    name: 'Bitcoin',
                    type: 'Crypto',
                    quantity: amountBtc.toString(),
                    avgCost: '0', 
                });
            }

            // Reset mining counters in the database
            await tx.update(users)
                .set({ unclaimedBtc: '0', lastMiningUpdateAt: new Date() })
                .where(eq(users.id, session.id));

            return { success: `Vous avez réclamé ${amountBtc.toFixed(8)} BTC.` };
        });

        revalidatePath('/portfolio');
        revalidatePath('/mining');
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}
