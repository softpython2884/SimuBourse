'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers, users, companyShares, companyHoldings } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';

const createCompanySchema = z.object({
  name: z.string().min(3, "Le nom doit faire au moins 3 caractères.").max(50),
  industry: z.string().min(3, "L'industrie doit faire au moins 3 caractères.").max(50),
  description: z.string().min(10, "La description doit faire au moins 10 caractères.").max(200),
});

export async function createCompany(values: z.infer<typeof createCompanySchema>): Promise<{ success?: string; error?: string }> {
  const session = await getSession();
  if (!session?.id) {
    return { error: "Vous devez être connecté pour créer une entreprise." };
  }

  const validatedFields = createCompanySchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Données invalides." };
  }
  const { name, industry, description } = validatedFields.data;

  try {
    await db.transaction(async (tx) => {
      // Create the company
      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
      }).returning();

      // Add the creator as the CEO
      await tx.insert(companyMembers).values({
        companyId: newCompany.id,
        userId: session.id,
        role: 'ceo',
      });
    });

    revalidatePath('/companies');
    return { success: `L'entreprise "${name}" a été créée avec succès !` };
  } catch (error: any) {
    // Check for unique constraint violation
    if (error?.code === '23505') {
        return { error: "Une entreprise avec ce nom existe déjà." };
    }
    console.error("Error creating company:", error);
    return { error: "Une erreur est survenue lors de la création de l'entreprise." };
  }
}

export async function getCompanies() {
  try {
    const allCompanies = await db.query.companies.findMany({
        orderBy: (companies, { desc }) => [desc(companies.createdAt)],
    });
    return allCompanies;
  } catch (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
}

export type Company = Awaited<ReturnType<typeof getCompanies>>[0];


export async function getCompanyById(companyId: number) {
  try {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        creator: {
          columns: {
            displayName: true,
          }
        },
        members: {
          with: {
            user: {
              columns: {
                displayName: true,
                id: true,
              }
            }
          },
           orderBy: (companyMembers, { asc }) => [asc(companyMembers.id)],
        },
        shares: {
          with: {
            user: {
              columns: {
                displayName: true,
                id: true,
              }
            }
          },
           orderBy: (companyShares, { desc }) => [desc(companyShares.quantity)],
        },
        holdings: {
           orderBy: (companyHoldings, { desc }) => [desc(companyHoldings.updatedAt)],
        }
      }
    });

    if (!company) {
        return null;
    }

    // Convert numeric strings to numbers for easier use on the client
    return {
      ...company,
      cash: parseFloat(company.cash),
      sharePrice: parseFloat(company.sharePrice),
      totalShares: parseFloat(company.totalShares),
      shares: company.shares.map(s => ({...s, quantity: parseFloat(s.quantity)})),
      holdings: company.holdings.map(h => ({
        ...h,
        quantity: parseFloat(h.quantity),
        avgCost: parseFloat(h.avgCost),
      }))
    };

  } catch (error) {
    console.error("Error fetching company by ID:", error);
    return null;
  }
}

export type CompanyWithDetails = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;


export async function investInCompany(companyId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: "Vous devez être connecté pour investir." };
    }
    if (amount <= 0) {
        return { error: "Le montant de l'investissement doit être positif." };
    }

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Get user and company data
            const user = await tx.query.users.findFirst({
                where: eq(users.id, session.id),
                columns: { cash: true }
            });
            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId),
                columns: { name: true, cash: true, sharePrice: true, totalShares: true }
            });

            if (!user) throw new Error("Utilisateur non trouvé.");
            if (!company) throw new Error("Entreprise non trouvée.");

            const userCash = parseFloat(user.cash);
            if (userCash < amount) {
                throw new Error("Fonds insuffisants.");
            }
            
            const sharePrice = parseFloat(company.sharePrice);
            const totalShares = parseFloat(company.totalShares);
            const sharesToBuy = amount / sharePrice;
            
            // 2. Update balances
            const newUserCash = userCash - amount;
            const newCompanyCash = parseFloat(company.cash) + amount;
            
            await tx.update(users).set({ cash: newUserCash.toFixed(2) }).where(eq(users.id, session.id));
            
            // 3. Update company's share price and cash
            const marketCap = sharePrice * totalShares;
            const inflationFactor = (amount / (marketCap + amount)) * 0.1; // Max 10% influence on price per trade
            const newSharePrice = sharePrice * (1 + inflationFactor);
            const newTotalShares = totalShares + sharesToBuy;

            await tx.update(companies).set({ 
                cash: newCompanyCash.toFixed(2),
                sharePrice: newSharePrice.toFixed(2),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));

            // 4. Update user's share ownership
            const existingShares = await tx.query.companyShares.findFirst({
                where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId))
            });

            if (existingShares) {
                const newQuantity = parseFloat(existingShares.quantity) + sharesToBuy;
                await tx.update(companyShares)
                    .set({ quantity: newQuantity.toString() })
                    .where(eq(companyShares.id, existingShares.id));
            } else {
                await tx.insert(companyShares).values({
                    userId: session.id,
                    companyId: companyId,
                    quantity: sharesToBuy.toString()
                });
            }
            
            return { success: `Vous avez investi ${amount.toFixed(2)}$ dans ${company.name} !` };
        });

        revalidatePath(`/companies/${companyId}`);
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'investissement." };
    }
}

const assetSchema = z.object({
  name: z.string(),
  ticker: z.string(),
  price: z.number(),
  type: z.enum(['Stock', 'Crypto', 'Commodity', 'Forex']),
});

export async function buyAssetForCompany(companyId: number, asset: z.infer<typeof assetSchema>, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: "Vous devez être connecté pour effectuer cette action." };
    }

    if (quantity <= 0) {
        return { error: "La quantité doit être positive." };
    }

    try {
        const cost = asset.price * quantity;

        const result = await db.transaction(async (tx) => {
            // 1. Authorization: Check if user is CEO
            const member = await tx.query.companyMembers.findFirst({
                where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id))
            });

            if (!member || member.role !== 'ceo') {
                throw new Error("Seul le PDG peut gérer le portefeuille de l'entreprise.");
            }

            // 2. Check company cash
            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId),
                columns: { cash: true }
            });

            if (!company) {
                throw new Error("Entreprise non trouvée.");
            }

            const companyCash = parseFloat(company.cash);
            if (companyCash < cost) {
                throw new Error("Trésorerie de l'entreprise insuffisante.");
            }
            
            // 3. Update balances
            const newCompanyCash = companyCash - cost;
            await tx.update(companies).set({ cash: newCompanyCash.toFixed(2) }).where(eq(companies.id, companyId));

            // 4. Update company's holdings
            const existingHolding = await tx.query.companyHoldings.findFirst({
                where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, asset.ticker))
            });

            if (existingHolding) {
                const existingQuantity = parseFloat(existingHolding.quantity);
                const existingAvgCost = parseFloat(existingHolding.avgCost);
                const newTotalQuantity = existingQuantity + quantity;
                const newAvgCost = ((existingAvgCost * existingQuantity) + cost) / newTotalQuantity;

                await tx.update(companyHoldings)
                    .set({ quantity: newTotalQuantity.toString(), avgCost: newAvgCost.toString(), updatedAt: new Date() })
                    .where(eq(companyHoldings.id, existingHolding.id));
            } else {
                await tx.insert(companyHoldings).values({
                    companyId: companyId,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity: quantity.toString(),
                    avgCost: asset.price.toString(),
                });
            }

            return { success: `L'entreprise a acheté ${quantity} ${asset.ticker}.` };
        });

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error buying asset for company:", error);
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}
