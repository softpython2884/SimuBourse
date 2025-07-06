'use server';

import { db } from '@/lib/db';
import { aiNews, companies, users, holdings as holdingsSchema, assets as assetsSchema } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq, and, ilike } from 'drizzle-orm';

export async function resetAiNews(): Promise<{ success?: string; error?: string }> {
    try {
        await db.delete(aiNews);
        // Revalidate all trading pages to ensure they fetch fresh news.
        revalidatePath('/trading', 'layout');
        return { success: 'Toutes les actualités IA ont été supprimées.' };
    } catch (error) {
        console.error('Error resetting AI news:', error);
        return { error: 'Une erreur est survenue lors de la suppression des actualités.' };
    }
}

export async function resetAllCompanies(): Promise<{ success?: string; error?: string }> {
    try {
        await db.delete(companies);
        revalidatePath('/companies', 'layout');
        revalidatePath('/admin');
        return { success: 'Toutes les entreprises ont été supprimées.' };
    } catch (error) {
        console.error('Error resetting companies:', error);
        return { error: 'Une erreur est survenue lors de la suppression des entreprises.' };
    }
}

export async function resetAllUsers(): Promise<{ success?: string; error?: string }> {
    try {
        // This will cascade delete almost everything due to schema relations.
        await db.delete(users);
        revalidatePath('/', 'layout'); // Revalidate everything
        return { success: 'Tous les utilisateurs ont été supprimés. Vous devez vous réinscrire.' };
    } catch (error) {
        console.error('Error resetting users:', error);
        return { error: 'Une erreur est survenue lors de la suppression des utilisateurs.' };
    }
}

export async function addCryptoToUserByEmail(data: { email: string, ticker: string, quantity: number }): Promise<{ success?: string; error?: string }> {
    try {
        const { email, ticker, quantity } = data;
        if (quantity <= 0) {
            return { error: 'La quantité doit être positive.' };
        }

        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: ilike(users.email, email)
            });

            if (!user) {
                throw new Error(`Utilisateur avec l'email "${email}" non trouvé.`);
            }

            const asset = await tx.query.assets.findFirst({
                where: eq(assetsSchema.ticker, ticker.toUpperCase())
            });

            if (!asset || asset.type !== 'Crypto') {
                throw new Error(`Actif crypto avec le ticker "${ticker}" non trouvé.`);
            }

            const existingHolding = await tx.query.holdings.findFirst({
                where: and(eq(holdingsSchema.userId, user.id), eq(holdingsSchema.ticker, asset.ticker))
            });

            if (existingHolding) {
                const newQuantity = parseFloat(existingHolding.quantity) + quantity;
                // For granted assets, we don't change the average cost. If it's the first grant, avgCost is 0.
                await tx.update(holdingsSchema)
                    .set({ quantity: newQuantity.toString() })
                    .where(eq(holdingsSchema.id, existingHolding.id));
            } else {
                await tx.insert(holdingsSchema).values({
                    userId: user.id,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity: quantity.toString(),
                    avgCost: '0', // Granted assets have no cost
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
