'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { users, userMiningRigs } from '@/lib/db/schema';
import { getSession } from '@/lib/session';
import { getRigById } from '@/lib/mining';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const rigIdSchema = z.string().min(1).max(64);

export async function buyMiningRig(rigId: string): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };

    const parsed = rigIdSchema.safeParse(rigId);
    if (!parsed.success) return { error: 'Identifiant de matériel invalide.' };

    const rigToBuy = getRigById(parsed.data);
    if (!rigToBuy) return { error: 'Matériel de minage non valide.' };

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true },
            });
            if (!user) throw new Error("Utilisateur non trouvé.");
            if (user.cash < rigToBuy.price) throw new Error("Fonds insuffisants.");

            await tx.update(users).set({ cash: sql`cash - ${rigToBuy.price}` }).where(eq(users.id, session.id));

            const existingRig = await tx.query.userMiningRigs.findFirst({
                where: and(eq(userMiningRigs.userId, session.id), eq(userMiningRigs.rigId, parsed.data)),
            });

            if (existingRig) {
                await tx.update(userMiningRigs)
                    .set({ quantity: existingRig.quantity + 1 })
                    .where(eq(userMiningRigs.id, existingRig.id));
            } else {
                await tx.insert(userMiningRigs).values({
                    userId: session.id,
                    rigId: parsed.data,
                    quantity: 1,
                });
            }

            return { success: `${rigToBuy.name} acheté avec succès !` };
        });

        revalidatePath('/mining');
        revalidatePath('/portfolio');
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}
