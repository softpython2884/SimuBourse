'use server';

import { db } from '@/lib/db';
import { aiNews, companies, users } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

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
