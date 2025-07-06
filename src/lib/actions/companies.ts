'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers, users, companyShares, companyHoldings, assets as assetsSchema } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { updatePriceFromTrade } from './assets';

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
    
    // Fetch all asset prices for valuation
    const allAssets = await db.query.assets.findMany();
    const priceMap = allAssets.reduce((map, asset) => {
        map[asset.ticker] = parseFloat(asset.price);
        return map;
    }, {} as Record<string, number>);

    const portfolioValue = company.holdings.reduce((sum, holding) => {
      const currentPrice = priceMap[holding.ticker] || parseFloat(holding.avgCost);
      return sum + (parseFloat(holding.quantity) * currentPrice);
    }, 0);

    const companyCash = parseFloat(company.cash);
    const companyValue = companyCash + portfolioValue;
    const totalShares = parseFloat(company.totalShares);
    const sharePrice = totalShares > 0 ? companyValue / totalShares : 0;

    return {
      ...company,
      cash: companyCash,
      sharePrice: sharePrice,
      totalShares: totalShares,
      marketCap: companyValue,
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

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            if (parseFloat(user.cash) < amount) throw new Error("Fonds insuffisants.");

            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId),
                with: { holdings: true }
            });
            if (!company) throw new Error("Entreprise non trouvée.");

            const allAssets = await tx.query.assets.findMany();
            const priceMap = allAssets.reduce((map, asset) => {
                map[asset.ticker] = parseFloat(asset.price);
                return map;
            }, {} as Record<string, number>);

            const portfolioValue = company.holdings.reduce((sum, holding) => {
                const currentPrice = priceMap[holding.ticker] || parseFloat(holding.avgCost);
                return sum + (parseFloat(holding.quantity) * currentPrice);
            }, 0);

            const companyValue = parseFloat(company.cash) + portfolioValue;
            const totalShares = parseFloat(company.totalShares);
            const preInvestmentSharePrice = totalShares > 0 ? companyValue / totalShares : parseFloat(company.sharePrice);

            if (amount <= 0) throw new Error("Le montant de l'investissement doit être positif.");
            if (preInvestmentSharePrice <= 0) throw new Error("Le prix de l'action est nul, l'investissement est impossible.");

            const sharesToBuy = amount / preInvestmentSharePrice;
            const newCompanyCash = parseFloat(company.cash) + amount;
            const newTotalShares = totalShares + sharesToBuy;
            
            await tx.update(users).set({ cash: (parseFloat(user.cash) - amount).toFixed(2) }).where(eq(users.id, session.id));
            await tx.update(companies).set({ 
                cash: newCompanyCash.toFixed(2),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));

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

export async function buyAssetForCompany(companyId: number, ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté pour effectuer cette action." };
    if (quantity <= 0) return { error: "La quantité doit être positive." };

    try {
        const asset = await db.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
        if (!asset) return { error: "Actif non trouvé." };

        const price = parseFloat(asset.price);
        const cost = price * quantity;
        
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer le portefeuille de l'entreprise.");

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");

            const companyCash = parseFloat(company.cash);
            if (companyCash < cost) throw new Error("Trésorerie de l'entreprise insuffisante.");
            
            await tx.update(companies).set({ cash: (companyCash - cost).toFixed(2) }).where(eq(companies.id, companyId));

            const existingHolding = await tx.query.companyHoldings.findFirst({ where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, asset.ticker)) });

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
                    avgCost: price.toString(),
                });
            }

            return { success: `L'entreprise a acheté ${quantity} ${asset.ticker}.` };
        });

        if (result.success) {
            await updatePriceFromTrade(ticker, cost);
        }

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error buying asset for company:", error);
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}

export async function sellAssetForCompany(companyId: number, holdingId: number, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté pour effectuer cette action." };
    if (quantity <= 0) return { error: "La quantité doit être positive." };

    try {
        const holding = await db.query.companyHoldings.findFirst({ where: and(eq(companyHoldings.id, holdingId), eq(companyHoldings.companyId, companyId)) });
        if (!holding) throw new Error("Actif non détenu par l'entreprise.");
            
        const asset = await db.query.assets.findFirst({ where: eq(assetsSchema.ticker, holding.ticker) });
        if (!asset) return { error: "Actif non trouvé sur le marché." };

        const price = parseFloat(asset.price);
        const proceeds = price * quantity;

        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer le portefeuille de l'entreprise.");

            const holdingQuantity = parseFloat(holding.quantity);
            if (holdingQuantity < quantity) throw new Error("Quantité d'actifs de l'entreprise insuffisante pour la vente.");

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");

            await tx.update(companies).set({ cash: (parseFloat(company.cash) + proceeds).toFixed(2) }).where(eq(companies.id, companyId));

            const newQuantity = holdingQuantity - quantity;
            if (newQuantity < 1e-9) { 
                await tx.delete(companyHoldings).where(eq(companyHoldings.id, holding.id));
            } else {
                await tx.update(companyHoldings)
                    .set({ quantity: newQuantity.toString(), updatedAt: new Date() })
                    .where(eq(companyHoldings.id, holding.id));
            }

            return { success: `L'entreprise a vendu ${quantity} ${holding.ticker} pour ${proceeds.toFixed(2)}$.` };
        });
        
        if (result.success) {
            await updatePriceFromTrade(holding.ticker, -proceeds);
        }

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error selling asset for company:", error);
        return { error: error.message || "Une erreur est survenue lors de la vente." };
    }
}
