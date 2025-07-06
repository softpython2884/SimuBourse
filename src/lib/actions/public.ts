'use server';

import { db } from '@/lib/db';
import { users, transactions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export async function getPublicUserProfile(userId: string) {
    const id = parseInt(userId, 10);
    if (isNaN(id)) {
        notFound();
    }

    try {
        const userProfile = await db.query.users.findFirst({
            where: eq(users.id, id),
            columns: {
                displayName: true,
                createdAt: true,
            },
            with: {
                transactions: {
                    orderBy: [desc(transactions.createdAt)],
                    limit: 10,
                    columns: {
                        id: true,
                        type: true,
                        name: true,
                        ticker: true,
                        value: true,
                        createdAt: true,
                    }
                }
            }
        });

        if (!userProfile) {
            notFound();
        }
        
        const formattedTransactions = userProfile.transactions.map(tx => ({
            ...tx,
            value: parseFloat(tx.value),
            createdAt: new Date(tx.createdAt)
        }));

        return {
            ...userProfile,
            transactions: formattedTransactions
        };

    } catch (error) {
        console.error("Error fetching public user profile:", error);
        notFound();
    }
}

export type PublicProfileData = NonNullable<Awaited<ReturnType<typeof getPublicUserProfile>>>;
