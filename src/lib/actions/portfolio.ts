'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { runTransaction } from '@/lib/db/tx';
import { users, holdings, transactions, assets as assetsSchema, automaticOrders, userMiningRigs } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { getRigById } from '../mining';

const BTC_PER_MHS_PER_SECOND = 7.7e-12;

const profileUpdateSchema = z.object({
    displayName: z.string().min(3, { message: "Le nom d'utilisateur doit comporter au moins 3 caractères." }).max(50),
    phoneNumber: z.string().max(30).optional(),
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
            .set({ displayName, phoneNumber: phoneNumber || null })
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
        // Step 1: atomically accrue any mining yield earned since last update.
        // SQL formula avoids the "read-then-write" race where two concurrent profile
        // loads could both compute from the same lastMiningUpdateAt and overwrite each other.
        const rigsForHash = await db.query.userMiningRigs.findMany({
            where: eq(userMiningRigs.userId, session.id),
        });
        const totalHashRateMhs = rigsForHash.reduce((total, rig) => {
            const rigData = getRigById(rig.rigId);
            return total + (rigData?.hashRateMhs || 0) * rig.quantity;
        }, 0);

        if (totalHashRateMhs > 0) {
            const now = Date.now();
            const rate = totalHashRateMhs * BTC_PER_MHS_PER_SECOND;
            await db.update(users).set({
                unclaimedBtc: sql`unclaimed_btc + MAX(0, ((${now} - last_mining_update_at) / 1000.0) * ${rate})`,
                lastMiningUpdateAt: new Date(now),
            }).where(eq(users.id, session.id));
        }

        const userProfile = await db.query.users.findFirst({
            where: eq(users.id, session.id),
            columns: { passwordHash: false },
            with: {
                holdings: true,
                transactions: {
                    orderBy: [desc(transactions.createdAt)],
                    limit: 100,
                },
                miningRigs: true,
                companyShares: {
                    with: { company: true },
                },
            },
        });

        if (!userProfile) return null;

        const regularHoldings = userProfile.holdings.map(h => ({
            ...h,
            quantity: h.quantity,
            avgCost: h.avgCost,
            isCompanyShare: false,
            updatedAt: new Date(h.updatedAt),
            company: null,
        }));

        const companyShareHoldings = userProfile.companyShares.map(cs => ({
            id: cs.id,
            userId: cs.userId,
            ticker: cs.company.ticker,
            name: cs.company.name,
            type: 'Company Share' as const,
            isCompanyShare: true,
            quantity: cs.quantity,
            avgCost: cs.avgCost,
            updatedAt: new Date(cs.company.createdAt),
            company: {
                ...cs.company,
                cash: cs.company.cash,
                totalShares: cs.company.totalShares,
                sharePrice: cs.company.sharePrice,
            },
        }));

        const allHoldings = [...regularHoldings, ...companyShareHoldings];

        const formattedTransactions = userProfile.transactions.map(t => ({
            ...t,
            quantity: t.quantity,
            price: t.price,
            value: t.value,
            createdAt: new Date(t.createdAt),
            asset: { name: t.name, ticker: t.ticker },
        }));

        return {
            ...userProfile,
            cash: userProfile.cash,
            initialCash: userProfile.initialCash,
            createdAt: new Date(userProfile.createdAt),
            unclaimedBtc: userProfile.unclaimedBtc,
            holdings: allHoldings,
            transactions: formattedTransactions,
            miningRigs: userProfile.miningRigs,
        };
    } catch (error) {
        console.error('getAuthenticatedUserProfile error:', error);
        return null;
    }
}

const tradeSchema = z.object({
    ticker: z.string().min(1).max(20).regex(/^[A-Z0-9]+$/i),
    quantity: z.number().positive().finite().max(1e12),
    stopLoss: z.number().positive().finite().optional(),
    takeProfit: z.number().positive().finite().optional(),
});

export async function buyAssetAction(ticker: string, quantity: number, stopLoss?: number, takeProfit?: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };

    const parsed = tradeSchema.safeParse({ ticker, quantity, stopLoss, takeProfit });
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message || 'Données invalides.' };
    }
    const tickerUp = parsed.data.ticker.toUpperCase();
    const qty = parsed.data.quantity;

    try {
        await runTransaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");

            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, tickerUp) });
            if (!asset) throw new Error("Actif non trouvé.");

            const currentPrice = asset.price;
            const tradeValue = currentPrice * qty;

            if (user.cash < tradeValue) throw new Error("Fonds insuffisants.");

            await tx.update(users).set({ cash: sql`cash - ${tradeValue}` }).where(eq(users.id, session.id));

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });

            let holdingId: number;
            if (existingHolding) {
                // Weighted average cost computed atomically in SQL.
                await tx.update(holdings).set({
                    quantity: sql`quantity + ${qty}`,
                    avgCost: sql`((avg_cost * quantity) + ${tradeValue}) / (quantity + ${qty})`,
                    updatedAt: new Date(),
                }).where(eq(holdings.id, existingHolding.id));
                holdingId = existingHolding.id;
            } else {
                const [newHolding] = await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity: qty,
                    avgCost: currentPrice,
                }).returning({ id: holdings.id });
                holdingId = newHolding.id;
            }

            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Buy',
                ticker: tickerUp,
                name: asset.name,
                quantity: qty,
                price: currentPrice,
                value: tradeValue,
            });

            if (parsed.data.stopLoss) {
                await tx.insert(automaticOrders).values({
                    userId: session.id,
                    holdingId,
                    type: 'stop-loss',
                    triggerPrice: parsed.data.stopLoss,
                    quantity: qty,
                });
            }
            if (parsed.data.takeProfit) {
                await tx.insert(automaticOrders).values({
                    userId: session.id,
                    holdingId,
                    type: 'take-profit',
                    triggerPrice: parsed.data.takeProfit,
                    quantity: qty,
                });
            }
        });

        let successMessage = `Achat de ${qty} ${tickerUp} réussi !`;
        if (stopLoss || takeProfit) successMessage += " Ordres automatiques placés.";

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

    const parsed = tradeSchema.pick({ ticker: true, quantity: true }).safeParse({ ticker, quantity });
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message || 'Données invalides.' };
    }
    const tickerUp = parsed.data.ticker.toUpperCase();
    const qty = parsed.data.quantity;

    try {
        await runTransaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");

            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, tickerUp) });
            if (!asset) throw new Error("Actif non trouvé.");

            const currentPrice = asset.price;
            const tradeValue = currentPrice * qty;

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, asset.ticker)),
            });
            if (!existingHolding || existingHolding.quantity < qty) {
                throw new Error("Quantité d'actifs insuffisante pour la vente.");
            }

            await tx.update(users).set({ cash: sql`cash + ${tradeValue}` }).where(eq(users.id, session.id));

            const newQuantity = existingHolding.quantity - qty;
            if (newQuantity > 1e-9) {
                await tx.update(holdings).set({ quantity: newQuantity, updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                await tx.delete(automaticOrders).where(eq(automaticOrders.holdingId, existingHolding.id));
                await tx.delete(holdings).where(eq(holdings.id, existingHolding.id));
            }

            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Sell',
                ticker: tickerUp,
                name: asset.name,
                quantity: qty,
                price: currentPrice,
                value: tradeValue,
            });
        });

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return { success: `Vente de ${qty} ${tickerUp} réussie !` };
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la vente." };
    }
}

// Claim is now server-authoritative: the client cannot specify an amount.
// We recompute earnings server-side from rigs + elapsed time, then atomically
// transfer everything to a BTC holding.
export async function claimMiningRewards(_unused?: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };

    try {
        const result = await runTransaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { unclaimedBtc: true, lastMiningUpdateAt: true },
            });
            if (!user) throw new Error("Utilisateur non trouvé.");

            const rigs = await tx.query.userMiningRigs.findMany({
                where: eq(userMiningRigs.userId, session.id),
            });
            const hashRate = rigs.reduce((sum, r) => sum + (getRigById(r.rigId)?.hashRateMhs ?? 0) * r.quantity, 0);

            const now = Date.now();
            const elapsedSec = Math.max(0, (now - new Date(user.lastMiningUpdateAt).getTime()) / 1000);
            const accrued = hashRate * BTC_PER_MHS_PER_SECOND * elapsedSec;
            const total = (user.unclaimedBtc ?? 0) + accrued;

            if (total < 1e-9) throw new Error("Aucune récompense significative à réclamer.");

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdings.userId, session.id), eq(holdings.ticker, 'BTC')),
            });

            if (existingHolding) {
                await tx.update(holdings)
                    .set({ quantity: sql`quantity + ${total}`, updatedAt: new Date() })
                    .where(eq(holdings.id, existingHolding.id));
            } else {
                await tx.insert(holdings).values({
                    userId: session.id,
                    ticker: 'BTC',
                    name: 'Bitcoin',
                    type: 'Crypto',
                    quantity: total,
                    avgCost: 0,
                });
            }

            await tx.update(users)
                .set({ unclaimedBtc: 0, lastMiningUpdateAt: new Date(now) })
                .where(eq(users.id, session.id));

            return total;
        });

        revalidatePath('/portfolio');
        revalidatePath('/mining');
        return { success: `Vous avez réclamé ${result.toFixed(8)} BTC.` };
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}
