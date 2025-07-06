'use server';

import { db } from '@/lib/db';
import { users, userMiningRigs } from '@/lib/db/schema';
import { getSession } from '@/lib/session';
import { getRigById } from '@/lib/mining';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function buyMiningRig(rigId: string): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: 'Non autorisé.' };
    }

    const rigToBuy = getRigById(rigId);
    if (!rigToBuy) {
        return { error: 'Matériel de minage non valide.' };
    }

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });

            if (!user) {
                throw new Error("Utilisateur non trouvé.");
            }

            const userCash = parseFloat(user.cash);
            if (userCash < rigToBuy.price) {
                throw new Error("Fonds insuffisants.");
            }

            // Deduct cost
            const newCash = userCash - rigToBuy.price;
            await tx.update(users).set({ cash: newCash.toFixed(2) }).where(eq(users.id, session.id));

            // Add or update rig
            const existingRig = await tx.query.userMiningRigs.findFirst({
                where: and(eq(userMiningRigs.userId, session.id), eq(userMiningRigs.rigId, rigId)),
            });

            if (existingRig) {
                await tx.update(userMiningRigs)
                    .set({ quantity: existingRig.quantity + 1 })
                    .where(eq(userMiningRigs.id, existingRig.id));
            } else {
                await tx.insert(userMiningRigs).values({
                    userId: session.id,
                    rigId: rigId,
                    quantity: 1,
                });
            }

            return { success: `${rigToBuy.name} acheté avec succès !` };
        });

        revalidatePath('/mining');
        revalidatePath('/portfolio'); // to update cash
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}