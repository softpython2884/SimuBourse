'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { aiNews, companies, users, holdings as holdingsSchema, assets as assetsSchema } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/session';

export async function resetAiNews(): Promise<{ success?: string; error?: string }> {
    try {
        await requireAdmin();
        await db.delete(aiNews);
        revalidatePath('/trading', 'layout');
        return { success: 'Toutes les actualités IA ont été supprimées.' };
    } catch (error: any) {
        console.error('Error resetting AI news:', error);
        return { error: error.message || 'Une erreur est survenue lors de la suppression des actualités.' };
    }
}

export async function resetAllCompanies(): Promise<{ success?: string; error?: string }> {
    try {
        await requireAdmin();
        await db.delete(companies);
        revalidatePath('/companies', 'layout');
        revalidatePath('/admin');
        return { success: 'Toutes les entreprises ont été supprimées.' };
    } catch (error: any) {
        console.error('Error resetting companies:', error);
        return { error: error.message || 'Une erreur est survenue lors de la suppression des entreprises.' };
    }
}

export async function resetAllUsers(): Promise<{ success?: string; error?: string }> {
    try {
        await requireAdmin();
        // Wipes every user including the calling admin. Cascade deletes everything.
        // The admin will need to sign up again — the first new user becomes admin automatically.
        await db.delete(users);
        revalidatePath('/', 'layout');
        return { success: 'Tous les utilisateurs ont été supprimés. Vous devez vous réinscrire.' };
    } catch (error: any) {
        console.error('Error resetting users:', error);
        return { error: error.message || 'Une erreur est survenue lors de la suppression des utilisateurs.' };
    }
}

const addCryptoSchema = z.object({
    email: z.string().email().max(254),
    ticker: z.string().min(1).max(10),
    quantity: z.number().positive().finite().max(1e12),
});

export async function addCryptoToUserByEmail(data: { email: string, ticker: string, quantity: number }): Promise<{ success?: string; error?: string }> {
    try {
        await requireAdmin();

        const parsed = addCryptoSchema.safeParse(data);
        if (!parsed.success) {
            return { error: 'Données invalides.' };
        }

        const email = parsed.data.email.toLowerCase();
        const ticker = parsed.data.ticker.toUpperCase();
        const { quantity } = parsed.data;

        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.email, email),
            });

            if (!user) {
                throw new Error(`Utilisateur avec l'email "${email}" non trouvé.`);
            }

            const asset = await tx.query.assets.findFirst({
                where: eq(assetsSchema.ticker, ticker)
            });

            if (!asset || asset.type !== 'Crypto') {
                throw new Error(`Actif crypto avec le ticker "${ticker}" non trouvé.`);
            }

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdingsSchema.userId, user.id), eq(holdingsSchema.ticker, asset.ticker))
            });

            if (existingHolding) {
                await tx.update(holdingsSchema)
                    .set({ quantity: existingHolding.quantity + quantity, updatedAt: new Date() })
                    .where(eq(holdingsSchema.id, existingHolding.id));
            } else {
                await tx.insert(holdingsSchema).values({
                    userId: user.id,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity,
                    avgCost: 0,
                });
            }
            return { success: `A accordé avec succès ${quantity} ${asset.ticker} à ${user.displayName}.` };
        });

        revalidatePath('/portfolio');
        revalidatePath('/profile');
        return result;

    } catch (error: any) {
        console.error('Error adding crypto to user:', error);
        return { error: error.message || 'Une erreur est survenue.' };
    }
}
