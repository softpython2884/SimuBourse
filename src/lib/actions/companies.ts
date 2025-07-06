'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers, users, companyShares, companyHoldings, assets as assetsSchema, companyMiningRigs } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, or, ilike, notInArray } from 'drizzle-orm';
import { updatePriceFromTrade } from './assets';
import { getRigById } from '@/lib/mining';

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
  
  const creationCost = 1000;

  const validatedFields = createCompanySchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Données invalides." };
  }
  const { name, industry, description } = validatedFields.data;

  try {
    const result = await db.transaction(async (tx) => {
      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");
      
      const userCash = parseFloat(user.cash);
      if (userCash < creationCost) throw new Error(`Fonds insuffisants. La création d'une entreprise coûte ${creationCost.toLocaleString()}$.`);

      // Deduct cost from user
      const newUserCash = userCash - creationCost;
      await tx.update(users).set({ cash: newUserCash.toFixed(2) }).where(eq(users.id, session.id));

      // Create the company with initial treasury
      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
        cash: creationCost.toFixed(2),
        totalShares: '10000.00000000',
        sharePrice: '0.10'
      }).returning();

      // Add the creator as the CEO
      await tx.insert(companyMembers).values({
        companyId: newCompany.id,
        userId: session.id,
        role: 'ceo',
      });

      return { success: `L'entreprise "${name}" a été créée avec succès ! ${creationCost.toLocaleString()}$ ont été transférés à la trésorerie.` };
    });

    revalidatePath('/companies');
    revalidatePath('/portfolio');
    revalidatePath('/profile');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    // Check for unique constraint violation
    if (error?.code === '23505') {
        return { error: "Une entreprise avec ce nom existe déjà." };
    }
    console.error("Error creating company:", error);
    return { error: error.message || "Une erreur est survenue lors de la création de l'entreprise." };
  }
}

export async function getCompaniesForUserDashboard() {
  const session = await getSession();

  const allCompanies = await db.query.companies.findMany({
      orderBy: (companies, { desc }) => [desc(companies.createdAt)],
  });

  const companiesWithMarketData = allCompanies.map(company => {
      const cash = parseFloat(company.cash);
      const totalShares = parseFloat(company.totalShares);
      const sharePrice = parseFloat(company.sharePrice);
      const marketCap = totalShares * sharePrice;
      
      return {
          ...company,
          cash: cash,
          marketCap: marketCap,
          sharePrice: sharePrice,
          totalShares: totalShares,
      }
  });


  if (!session?.id) {
    return {
      managedCompanies: [],
      investedCompanies: [],
      otherCompanies: companiesWithMarketData,
    };
  }

  const [userMemberships, userShares] = await Promise.all([
    db.query.companyMembers.findMany({ where: eq(companyMembers.userId, session.id) }),
    db.query.companyShares.findMany({ where: eq(companyShares.userId, session.id) }),
  ]);

  const managedCompanyIds = new Set(userMemberships.map(m => m.companyId));
  const investedCompanyIds = new Set(userShares.map(s => s.companyId));

  const managedCompanies: any[] = [];
  const investedCompanies: any[] = [];
  const otherCompanies: any[] = [];

  companiesWithMarketData.forEach(company => {
    if (managedCompanyIds.has(company.id)) {
      const membership = userMemberships.find(m => m.companyId === company.id);
      managedCompanies.push({ ...company, role: membership?.role });
    } else if (investedCompanyIds.has(company.id)) {
      const share = userShares.find(s => s.companyId === company.id);
      const sharesHeld = parseFloat(share?.quantity || '0');
      investedCompanies.push({ 
          ...company, 
          sharesHeld: sharesHeld,
          sharesValue: sharesHeld * company.sharePrice,
      });
    } else {
      otherCompanies.push(company);
    }
  });

  return { managedCompanies, investedCompanies, otherCompanies };
}

export type ManagedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['managedCompanies'][0];
export type InvestedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['investedCompanies'][0];
export type OtherCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['otherCompanies'][0];


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
        },
        miningRigs: true,
      }
    });

    if (!company) {
        return null;
    }
    
    // --- OFFLINE MINING CALCULATION FOR COMPANY ---
    const totalCompanyHashRate = company.miningRigs.reduce((total, ownedRig) => {
        const rigData = getRigById(ownedRig.rigId);
        return total + (rigData?.hashRateMhs || 0) * ownedRig.quantity;
    }, 0);

    let finalUnclaimedBtc = parseFloat(company.unclaimedBtc);

    if (totalCompanyHashRate > 0) {
        const now = new Date();
        const lastUpdate = new Date(company.lastMiningUpdateAt);
        const secondsElapsed = (now.getTime() - lastUpdate.getTime()) / 1000;

        if (secondsElapsed > 1) {
            const BTC_PER_MHS_PER_SECOND = 7.7e-12; // Same as user's
            const earnedOffline = totalCompanyHashRate * BTC_PER_MHS_PER_SECOND * secondsElapsed;
            finalUnclaimedBtc += earnedOffline;
            
            await db.update(companies)
                .set({ unclaimedBtc: finalUnclaimedBtc.toString(), lastMiningUpdateAt: now })
                .where(eq(companies.id, company.id));
        }
    }
    // --- END CALCULATION ---

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

    const miningRigsValue = company.miningRigs.reduce((total, ownedRig) => {
        const rigData = getRigById(ownedRig.rigId);
        return total + (rigData?.price || 0) * ownedRig.quantity;
    }, 0);

    const unclaimedBtcValue = finalUnclaimedBtc * (priceMap['BTC'] || 0);

    const companyCash = parseFloat(company.cash);
    const companyValue = companyCash + portfolioValue + miningRigsValue + unclaimedBtcValue;
    const totalShares = parseFloat(company.totalShares);
    const sharePrice = totalShares > 0 ? companyValue / totalShares : parseFloat(company.sharePrice);

    return {
      ...company,
      cash: companyCash,
      sharePrice: sharePrice,
      totalShares: totalShares,
      marketCap: companyValue,
      miningRigsValue: miningRigsValue,
      unclaimedBtc: finalUnclaimedBtc,
      shares: company.shares.map(s => ({...s, quantity: parseFloat(s.quantity)})),
      holdings: company.holdings.map(h => ({
        ...h,
        quantity: parseFloat(h.quantity),
        avgCost: parseFloat(h.avgCost),
      })),
      miningRigs: company.miningRigs,
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

            const companyData = await getCompanyById(companyId);
            if (!companyData) throw new Error("Entreprise non trouvée.");
            
            const preInvestmentSharePrice = companyData.sharePrice;

            if (amount <= 0) throw new Error("Le montant de l'investissement doit être positif.");
            if (preInvestmentSharePrice <= 0) throw new Error("Le prix de l'action est nul, l'investissement est impossible.");

            const sharesToBuy = amount / preInvestmentSharePrice;
            const newCompanyCash = companyData.cash + amount;
            const newTotalShares = companyData.totalShares + sharesToBuy;
            
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
            
            return { success: `Vous avez investi ${amount.toFixed(2)}$ dans ${companyData.name} !` };
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

export async function sellShares(companyId: number, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) {
        return { error: "Vous devez être connecté pour vendre des parts." };
    }
    if (quantity <= 0) {
        return { error: "La quantité doit être positive." };
    }

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");

            const companyData = await getCompanyById(companyId); // This function calculates current share price
            if (!companyData) throw new Error("Entreprise non trouvée.");

            const userShareHolding = await tx.query.companyShares.findFirst({
                where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId))
            });

            const sharesHeld = parseFloat(userShareHolding?.quantity || '0');
            if (sharesHeld < quantity) {
                throw new Error("Vous ne possédez pas assez de parts pour cette vente.");
            }

            const proceeds = quantity * companyData.sharePrice;
            if (companyData.cash < proceeds) {
                throw new Error("La trésorerie de l'entreprise est insuffisante pour racheter ces parts.");
            }
            
            // Perform transaction
            const newCompanyCash = companyData.cash - proceeds;
            const newTotalShares = companyData.totalShares - quantity;
            const newUserCash = parseFloat(user.cash) + proceeds;
            
            await tx.update(companies).set({ 
                cash: newCompanyCash.toFixed(2),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));

            await tx.update(users).set({ cash: newUserCash.toFixed(2) }).where(eq(users.id, session.id));
            
            const newSharesHeld = sharesHeld - quantity;
            if (newSharesHeld < 1e-9) { // If selling all shares
                await tx.delete(companyShares).where(eq(companyShares.id, userShareHolding!.id));
            } else {
                await tx.update(companyShares)
                    .set({ quantity: newSharesHeld.toString() })
                    .where(eq(companyShares.id, userShareHolding!.id));
            }

            return { success: `Vous avez vendu ${quantity.toFixed(4)} parts de ${companyData.name} pour ${proceeds.toFixed(2)}$.` };
        });

        revalidatePath(`/companies`);
        revalidatePath(`/companies/${companyId}`);
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la vente." };
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


export async function addCashToCompany(companyId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté." };
    if (amount <= 0) return { error: "Le montant doit être positif." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut ajouter des fonds à la trésorerie.");

            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            if (parseFloat(user.cash) < amount) throw new Error("Fonds personnels insuffisants.");

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");

            await tx.update(users).set({ cash: (parseFloat(user.cash) - amount).toFixed(2) }).where(eq(users.id, session.id));
            await tx.update(companies).set({ cash: (parseFloat(company.cash) + amount).toFixed(2) }).where(eq(companies.id, companyId));

            return { success: `${amount.toFixed(2)}$ ajoutés à la trésorerie de l'entreprise.` };
        });

        revalidatePath(`/companies/${companyId}`);
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue." };
    }
}

export async function withdrawFromCompanyTreasury(companyId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté." };
    if (amount <= 0) return { error: "Le montant doit être positif." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut retirer des fonds de la trésorerie.");

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");
            if (parseFloat(company.cash) < amount) throw new Error("Trésorerie de l'entreprise insuffisante.");
            
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");

            await tx.update(companies).set({ cash: (parseFloat(company.cash) - amount).toFixed(2) }).where(eq(companies.id, companyId));
            await tx.update(users).set({ cash: (parseFloat(user.cash) + amount).toFixed(2) }).where(eq(users.id, session.id));

            return { success: `${amount.toFixed(2)}$ retirés de la trésorerie de l'entreprise.` };
        });

        revalidatePath(`/companies/${companyId}`);
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue." };
    }
}

export async function buyMiningRigForCompany(companyId: number, rigId: string): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };

    const rigToBuy = getRigById(rigId);
    if (!rigToBuy) return { error: "Matériel de minage non valide." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut acheter du matériel pour l'entreprise.");
            
            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");

            const companyCash = parseFloat(company.cash);
            if (companyCash < rigToBuy.price) throw new Error("Trésorerie de l'entreprise insuffisante.");

            const newCash = companyCash - rigToBuy.price;
            await tx.update(companies).set({ cash: newCash.toFixed(2) }).where(eq(companies.id, companyId));

            const existingRig = await tx.query.companyMiningRigs.findFirst({
                where: and(eq(companyMiningRigs.companyId, companyId), eq(companyMiningRigs.rigId, rigId)),
            });

            if (existingRig) {
                await tx.update(companyMiningRigs)
                    .set({ quantity: existingRig.quantity + 1 })
                    .where(eq(companyMiningRigs.id, existingRig.id));
            } else {
                await tx.insert(companyMiningRigs).values({
                    companyId: companyId,
                    rigId: rigId,
                    quantity: 1,
                });
            }
            
            return { success: `L'entreprise a acheté un ${rigToBuy.name}.` };
        });

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error buying mining rig for company:", error);
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}


// Member Management
export async function searchUsersForCompany(companyId: number, query: string): Promise<{id: number, displayName: string, email: string}[]> {
  if (!query || query.length < 2) return [];

  const existingMembers = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
    columns: { userId: true }
  });
  const existingMemberIds = existingMembers.map(m => m.userId);

  const potentialUsers = await db.query.users.findMany({
    where: and(
        notInArray(users.id, existingMemberIds),
        or(
            ilike(users.displayName, `%${query}%`),
            ilike(users.email, `%${query}%`)
        )
    ),
    limit: 5,
    columns: { id: true, displayName: true, email: true }
  });

  return potentialUsers;
}


export async function addMemberToCompany(companyId: number, userId: number, role: 'manager' | 'member'): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };

    try {
        const result = await db.transaction(async (tx) => {
            const requesterMember = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!requesterMember || requesterMember.role !== 'ceo') throw new Error("Seul le PDG peut ajouter des membres.");

            const alreadyMember = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)) });
            if (alreadyMember) throw new Error("Cet utilisateur est déjà membre de l'entreprise.");

            const userToAdd = await tx.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true } });
            if (!userToAdd) throw new Error("Utilisateur à ajouter non trouvé.");

            await tx.insert(companyMembers).values({ companyId, userId, role });

            return { success: `${userToAdd.displayName} a été ajouté à l'entreprise.` };
        });
        
        revalidatePath(`/companies/${companyId}`);
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue." };
    }
}

export async function removeMemberFromCompany(companyId: number, memberIdToRemove: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };

    try {
        const result = await db.transaction(async (tx) => {
            const requesterMember = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!requesterMember || requesterMember.role !== 'ceo') throw new Error("Seul le PDG peut supprimer des membres.");
            
            const memberToRemove = await tx.query.companyMembers.findFirst({ where: eq(companyMembers.id, memberIdToRemove), with: { user: { columns: { displayName: true } } } });
            if (!memberToRemove) throw new Error("Membre non trouvé.");
            if (memberToRemove.role === 'ceo') throw new Error("Le PDG ne peut pas être supprimé.");

            await tx.delete(companyMembers).where(eq(companyMembers.id, memberIdToRemove));

            return { success: `${memberToRemove.user.displayName} a été retiré de l'entreprise.` };
        });
        
        revalidatePath(`/companies/${companyId}`);
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue." };
    }
}
