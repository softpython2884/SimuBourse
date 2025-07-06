'use server';

import { db } from '@/lib/db';
import { aiNews } from '@/lib/db/schema';
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
