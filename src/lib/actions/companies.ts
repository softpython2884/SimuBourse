
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers, users, companyShares, companyHoldings, assets as assetsSchema, transactions, companyMiningRigs } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, or, ilike, notInArray, inArray, sql } from 'drizzle-orm';
import { getRigById } from '@/lib/mining';

const createCompanySchema = z.object({
  name: z.string().min(3, "Le nom doit faire au moins 3 caractères.").max(50, "Le nom ne doit pas dépasser 50 caractères."),
  industry: z.string().min(3, "L'industrie doit faire au moins 3 caractères.").max(50, "L'industrie ne doit pas dépasser 50 caractères."),
  description: z.string().min(10, "La description doit faire au moins 10 caractères.").max(200, "La description ne doit pas dépasser 200 caractères."),
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
  
  // Generate a unique 4-letter ticker.
  let ticker = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
  if (ticker.length < 4) {
    ticker = (ticker + 'X'.repeat(4 - ticker.length));
  }
  let isUnique = false;
  let attempt = 0;
  while(!isUnique && attempt < 10) {
    const existingTicker = await db.query.companies.findFirst({ where: eq(companies.ticker, ticker) });
    if (!existingTicker) {
        isUnique = true;
    } else {
        ticker = ticker.substring(0,3) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
        attempt++;
    }
  }
  if (!isUnique) return { error: "Impossible de générer un ticker unique. Veuillez essayer un autre nom."};


  try {
    const result = await db.transaction(async (tx) => {
      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");
      
      const userCash = parseFloat(user.cash);
      if (userCash < creationCost) throw new Error(`Fonds insuffisants. La création d'une entreprise coûte ${creationCost.toLocaleString()}$.`);

      await tx.update(users).set({ cash: (userCash - creationCost).toString() }).where(eq(users.id, session.id));

      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
        cash: creationCost.toString(),
        totalShares: '1000.00000000',
        sharePrice: '1.00',
        ticker: ticker,
      }).returning();

      await tx.insert(companyMembers).values({
        companyId: newCompany.id,
        userId: session.id,
        role: 'ceo',
      });
      
      await tx.insert(companyShares).values({
        companyId: newCompany.id,
        userId: session.id,
        quantity: '1000.00000000',
        avgCost: '1.00',
      });

      return { success: `L'entreprise "${name}" a été créée avec succès ! ${creationCost.toLocaleString()}$ ont été transférés à la trésorerie.` };
    });

    revalidatePath('/companies');
    revalidatePath('/portfolio');
    revalidatePath('/profile');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    if (error?.code === '23505') { 
        return { error: "Une entreprise avec un nom ou un ticker similaire existe déjà." };
    }
    return { error: error.message || "Une erreur est survenue lors de la création de l'entreprise." };
  }
}

export type CompanyHistoricalPoint = {
    date: string;
    price: number;
};

export async function getCompaniesForUserDashboard() {
    const session = await getSession();

    // First, update all company share prices based on their current NAV.
    const allCompaniesList = await db.query.companies.findMany();
    for (const company of allCompaniesList) {
        const nav = await getCompanyNAV(company.id, db);
        const totalShares = parseFloat(company.totalShares);
        const newSharePrice = totalShares > 0 ? nav / totalShares : 0;
        if (Math.abs(newSharePrice - parseFloat(company.sharePrice)) > 1e-9) {
            await db.update(companies).set({ sharePrice: newSharePrice.toString() }).where(eq(companies.id, company.id));
        }
    }

    const allCompaniesWithData = await db.query.companies.findMany({
        orderBy: (companies, { desc }) => [desc(companies.createdAt)],
    });

    const companiesWithMarketData = await Promise.all(allCompaniesWithData.map(async (company) => {
        const historicalData: CompanyHistoricalPoint[] = [];
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        let lastPrice = parseFloat(company.sharePrice) / (1 + (Math.random() - 0.45) * 0.1); 
        
        for (let i = 0; i < 24; i++) {
            const date = new Date(yesterday.getTime() + i * 60 * 60 * 1000);
            lastPrice *= (1 + (Math.random() - 0.5) * 0.05);
            if (lastPrice <= 0) lastPrice = 0.0001;
            historicalData.push({ date: date.toISOString(), price: lastPrice });
        }
        historicalData.push({ date: now.toISOString(), price: parseFloat(company.sharePrice) });

        const startPrice = historicalData[0]?.price || parseFloat(company.sharePrice);
        const change = parseFloat(company.sharePrice) - startPrice;
        const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;
        const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        
        const totalShares = parseFloat(company.totalShares);
        const sharePrice = parseFloat(company.sharePrice);
        
        return {
            ...company,
            cash: parseFloat(company.cash),
            marketCap: totalShares * sharePrice,
            sharePrice: sharePrice,
            totalShares: totalShares,
            historicalData,
            change24h,
        }
    }));
    
    // Get all listed companies, regardless of user
    const allListedCompanies = companiesWithMarketData.filter(c => c.isListed);

    // If there's no user, return all companies split into listed/private
    if (!session?.id) {
        const privateCompanies = companiesWithMarketData.filter(c => !c.isListed);
        return {
            managedCompanies: [],
            investedCompanies: [],
            otherPrivateCompanies: privateCompanies,
            listedCompanies: allListedCompanies,
        };
    }

    // If there is a user, determine their relationship with each company
    const [userMemberships, userShares] = await Promise.all([
        db.query.companyMembers.findMany({ where: eq(companyMembers.userId, session.id) }),
        db.query.companyShares.findMany({ where: eq(companyShares.userId, session.id) }),
    ]);

    const sharesByCompanyId = new Map(userShares.map(s => [s.companyId, s]));
    const membershipsByCompanyId = new Map(userMemberships.map(m => [m.companyId, m]));
    
    const managedCompanies: any[] = [];
    const investedCompanies: any[] = [];
    
    const privateCompanies = companiesWithMarketData.filter(c => !c.isListed);
    const managedAndInvestedIds = new Set<number>();

    // Process all companies user has a relation to (private and listed)
    const allRelatedCompanyIds = new Set([...sharesByCompanyId.keys(), ...membershipsByCompanyId.keys()]);
    
    for (const companyId of allRelatedCompanyIds) {
        const company = companiesWithMarketData.find(c => c.id === companyId);
        if (!company) continue;

        const membership = membershipsByCompanyId.get(companyId);
        const shareData = sharesByCompanyId.get(companyId);
        const sharesHeld = parseFloat(shareData?.quantity || '0');

        const companyData = {
            ...company,
            sharesHeld: sharesHeld,
            sharesValue: sharesHeld * company.sharePrice,
            role: membership?.role,
        };

        if (membership) {
            managedCompanies.push(companyData);
            managedAndInvestedIds.add(company.id);
        } else if (sharesHeld > 0 && !company.isListed) {
            // Only add to invested if not managed and it's a private company
            investedCompanies.push(companyData);
            managedAndInvestedIds.add(company.id);
        }
    }
    
    const otherPrivateCompanies = privateCompanies.filter(c => !allRelatedCompanyIds.has(c.id));
    
    // Add user's share data to all listed companies
    for(const company of allListedCompanies) {
         const shareData = sharesByCompanyId.get(company.id);
         if (shareData) {
            (company as any).sharesHeld = parseFloat(shareData.quantity);
         } else {
            (company as any).sharesHeld = 0;
         }
    }

    return { managedCompanies, investedCompanies, otherPrivateCompanies, listedCompanies: allListedCompanies };
}

export type ManagedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['managedCompanies'][0];
export type InvestedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['investedCompanies'][0];
export type OtherCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['otherPrivateCompanies'][0];
export type ListedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['listedCompanies'][0];


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
           orderBy: (companyShares, { desc }) => [desc(sql`CAST(${companyShares.quantity} AS numeric)`)],
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
            const BTC_PER_MHS_PER_SECOND = 7.7e-12;
            const earnedOffline = totalCompanyHashRate * BTC_PER_MHS_PER_SECOND * secondsElapsed;
            finalUnclaimedBtc += earnedOffline;
            
            await db.update(companies)
                .set({ unclaimedBtc: finalUnclaimedBtc.toString(), lastMiningUpdateAt: now })
                .where(eq(companies.id, company.id));
        }
    }
    
    const nav = await getCompanyNAV(companyId, db);
    const totalShares = parseFloat(company.totalShares);
    const sharePrice = totalShares > 0 ? nav / totalShares : 0;
    
    const marketCap = sharePrice * totalShares;

    const miningRigsValue = company.miningRigs.reduce((total, ownedRig) => {
        const rigData = getRigById(ownedRig.rigId);
        return total + (rigData?.price || 0) * ownedRig.quantity;
    }, 0);

    return {
      ...company,
      cash: parseFloat(company.cash),
      sharePrice: sharePrice,
      totalShares: totalShares,
      marketCap: marketCap,
      miningRigsValue: miningRigsValue,
      unclaimedBtc: finalUnclaimedBtc,
      shares: company.shares.map(s => ({...s, quantity: parseFloat(s.quantity), avgCost: parseFloat(s.avgCost)})),
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

export async function getCompanyNAV(companyId: number, tx: any) {
    const company = await tx.query.companies.findFirst({
        where: eq(companies.id, companyId),
        with: { holdings: true, miningRigs: true }
    });
    if (!company) throw new Error("Entreprise non trouvée pour le calcul de la NAV.");

    const holdingTickers = company.holdings.map(h => h.ticker);
    let marketAssetPrices: Map<string, number> = new Map();

    if (holdingTickers.length > 0) {
        const marketAssets = await tx.query.assets.findMany({
            where: inArray(assetsSchema.ticker, holdingTickers)
        });
        marketAssets.forEach(a => marketAssetPrices.set(a.ticker, parseFloat(a.price)));
    }

    const holdingsValue = company.holdings.reduce((sum, h) => {
        const price = marketAssetPrices.get(h.ticker) ?? 0;
        return sum + (price * parseFloat(h.quantity));
    }, 0);
    
    const miningRigsValue = company.miningRigs.reduce((sum, r) => {
        return sum + ((getRigById(r.rigId)?.price ?? 0) * r.quantity);
    }, 0);
    
    const btcAsset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, 'BTC'), columns: { price: true } });
    const btcPrice = btcAsset ? parseFloat(btcAsset.price) : 0;
    const unclaimedBtcValue = parseFloat(company.unclaimedBtc) * btcPrice;

    return parseFloat(company.cash) + holdingsValue + miningRigsValue + unclaimedBtcValue;
}

export async function investInCompany(companyId: number, amount: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Vous devez être connecté pour investir." };
    if (amount <= 0) return { error: "Le montant de l'investissement doit être positif." };

    try {
        const result = await db.transaction(async (tx) => {
            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            if (parseFloat(user.cash) < amount) throw new Error("Fonds insuffisants.");

            const companyData = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
            if (!companyData) throw new Error("Entreprise non trouvée.");
            
            const currentNav = await getCompanyNAV(companyId, tx);
            const currentTotalShares = parseFloat(companyData.totalShares);
            const sharePrice = currentTotalShares > 0 ? currentNav / currentTotalShares : 1; 
            
            if (sharePrice <= 0) throw new Error("Prix de l'action non valide, impossible d'investir.");

            const sharesToBuy = amount / sharePrice;
            
            await tx.update(users).set({ cash: (parseFloat(user.cash) - amount).toString() }).where(eq(users.id, session.id));
            
            const existingShares = await tx.query.companyShares.findFirst({
                where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId))
            });

            if (existingShares) {
                const oldQuantity = parseFloat(existingShares.quantity);
                const oldAvgCost = parseFloat(existingShares.avgCost);
                const newTotalQuantity = oldQuantity + sharesToBuy;
                const newAvgCost = ((oldAvgCost * oldQuantity) + amount) / newTotalQuantity;

                await tx.update(companyShares).set({ 
                    quantity: newTotalQuantity.toString(),
                    avgCost: newAvgCost.toString(),
                }).where(eq(companyShares.id, existingShares.id));
            } else {
                await tx.insert(companyShares).values({ 
                    userId: session.id, 
                    companyId: companyId, 
                    quantity: sharesToBuy.toString(),
                    avgCost: sharePrice.toString(),
                });
            }

            const newCompanyCash = parseFloat(companyData.cash) + amount;
            const newTotalShares = parseFloat(companyData.totalShares) + sharesToBuy;
            
            await tx.update(companies).set({ 
                cash: newCompanyCash.toString(),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));
            
            await tx.insert(transactions).values({
                userId: session.id,
                type: 'Buy',
                ticker: companyData.ticker,
                name: companyData.name,
                quantity: sharesToBuy.toString(),
                price: sharePrice.toString(),
                value: amount.toString(),
            });

            return { success: `Vous avez investi ${amount.toFixed(2)}$ dans ${companyData.name} !` };
        });

        revalidatePath(`/companies`, 'layout');
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
    if (!session?.id) return { error: "Vous devez être connecté pour vendre des parts." };
    if (quantity <= 0) return { error: "La quantité doit être positive." };

    try {
        const result = await db.transaction(async (tx) => {
            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
            if (!company) throw new Error("Entreprise non trouvée.");

            const userShareHolding = await tx.query.companyShares.findFirst({
                where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId))
            });
            const sharesHeld = parseFloat(userShareHolding?.quantity || '0');
            if (sharesHeld < quantity) throw new Error("Vous ne possédez pas assez de parts.");

            const currentNav = await getCompanyNAV(companyId, tx);
            const currentTotalShares = parseFloat(company.totalShares);
            const sharePrice = currentTotalShares > 0 ? currentNav / currentTotalShares : 0;
            const proceeds = sharePrice * quantity;

            // New 35/65 rule, but non-blocking
            const companyLiability = proceeds * 0.35;
            const companyCash = parseFloat(company.cash);
            const paymentFromCompany = Math.min(companyCash, companyLiability);

            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            
            // User gets full proceeds
            await tx.update(users).set({ cash: (parseFloat(user.cash) + proceeds).toString() }).where(eq(users.id, session.id));
            
            const newSharesHeld = sharesHeld - quantity;
            if (newSharesHeld < 1e-9) {
                await tx.delete(companyShares).where(eq(companyShares.id, userShareHolding!.id));
            } else {
                await tx.update(companyShares).set({ quantity: newSharesHeld.toString() }).where(eq(companyShares.id, userShareHolding!.id));
            }

            // Company cash decreases by what it paid, total shares decrease by amount sold
            const newCompanyCash = companyCash - paymentFromCompany;
            const newTotalShares = parseFloat(company.totalShares) - quantity;
            await tx.update(companies).set({ 
                cash: newCompanyCash.toString(),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));

             await tx.insert(transactions).values({
                userId: session.id,
                type: 'Sell',
                ticker: company.ticker,
                name: company.name,
                quantity: quantity.toString(),
                price: sharePrice.toString(),
                value: proceeds.toString(),
            });

            return { success: `Vous avez vendu ${quantity.toFixed(4)} parts de ${company.name} pour ${proceeds.toFixed(2)}$.` };
        });

        revalidatePath('/companies', 'layout');
        revalidatePath('/portfolio');
        revalidatePath('/profile');
        revalidatePath('/');
        return result;

    } catch (error: any) {
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
            
            await tx.update(users).set({ cash: (parseFloat(user.cash) - amount).toString() }).where(eq(users.id, session.id));
            await tx.update(companies).set({ cash: sql`${companies.cash} + ${amount}` }).where(eq(companies.id, companyId));
            
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
            
            await tx.update(companies).set({ cash: sql`${companies.cash} - ${amount}` }).where(eq(companies.id, companyId));
            await tx.update(users).set({ cash: (parseFloat(user.cash) + amount).toString() }).where(eq(users.id, session.id));
            
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

export async function searchUsersForCompany(companyId: number, query: string): Promise<{id: number, displayName: string, email: string}[]> {
  if (!query || query.length < 2) return [];

  const existingMembers = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
    columns: { userId: true }
  });
  const existingMemberIds = existingMembers.map(m => m.userId);

  const potentialUsers = await db.query.users.findMany({
    where: and(
        notInArray(users.id, existingMemberIds.length > 0 ? existingMemberIds : [0]),
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

export async function listCompanyOnMarket(companyId: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };
  
    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({
                where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
            });
        
            if (!member || member.role !== 'ceo') {
                throw new Error('Seul le PDG peut mettre une entreprise en bourse.');
            }

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
            if (!company) throw new Error("Entreprise non trouvée.");
            if (company.isListed) throw new Error("L'entreprise est déjà cotée.");
            
            await tx.update(companies).set({ 
                isListed: true,
            }).where(eq(companies.id, companyId));
        
            return { success: 'Entreprise mise en bourse avec succès !' };
        });

      revalidatePath(`/companies`, 'layout');
      revalidatePath(`/companies/${companyId}`);
  
      return result;
    } catch (error: any) {
      return { error: error.message || "Une erreur est survenue." };
    }
}

export async function claimCompanyBtc(companyId: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({
                where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id))
            });
            if (!member || member.role !== 'ceo') {
                throw new Error("Seul le PDG peut réclamer les récompenses de minage.");
            }

            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId),
                columns: { unclaimedBtc: true }
            });
            if (!company) throw new Error("Entreprise non trouvée.");

            const amountBtc = parseFloat(company.unclaimedBtc);
            if (amountBtc < 1e-9) { 
                throw new Error("Pas assez de BTC à réclamer.");
            }

            const existingHolding = await tx.query.companyHoldings.findFirst({
                where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, 'BTC'))
            });

            if (existingHolding) {
                const newQuantity = parseFloat(existingHolding.quantity) + amountBtc;
                await tx.update(companyHoldings)
                    .set({ quantity: newQuantity.toString(), updatedAt: new Date() })
                    .where(eq(companyHoldings.id, existingHolding.id));
            } else {
                await tx.insert(companyHoldings).values({
                    companyId: companyId,
                    ticker: 'BTC',
                    name: 'Bitcoin',
                    type: 'Crypto',
                    quantity: amountBtc.toString(),
                    avgCost: '0',
                });
            }

            await tx.update(companies).set({ unclaimedBtc: '0', lastMiningUpdateAt: new Date() }).where(eq(companies.id, companyId));
            
            return { success: `Vous avez réclamé ${amountBtc.toFixed(8)} BTC pour l'entreprise.` };
        });

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error claiming company BTC: ", error);
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}

export async function buyAssetForCompany(companyId: number, ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };
    if (quantity <= 0) return { error: "La quantité doit être positive." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer les actifs de l'entreprise.");

            const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
            if (!company) throw new Error("Entreprise non trouvée.");

            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, ticker) });
            if (!asset) throw new Error("Actif à acheter non trouvé.");

            const tradeValue = parseFloat(asset.price) * quantity;
            if (parseFloat(company.cash) < tradeValue) throw new Error("Trésorerie de l'entreprise insuffisante.");

            await tx.update(companies).set({ cash: sql`${companies.cash} - ${tradeValue}` }).where(eq(companies.id, companyId));

            const existingHolding = await tx.query.companyHoldings.findFirst({
                where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, ticker)),
            });

            if (existingHolding) {
                const existingQuantity = parseFloat(existingHolding.quantity);
                const existingAvgCost = parseFloat(existingHolding.avgCost);
                const newTotalQuantity = existingQuantity + quantity;
                const newAvgCost = ((existingAvgCost * existingQuantity) + tradeValue) / newTotalQuantity;
                await tx.update(companyHoldings).set({ quantity: newTotalQuantity.toString(), avgCost: newAvgCost.toString(), updatedAt: new Date() }).where(eq(companyHoldings.id, existingHolding.id));
            } else {
                await tx.insert(companyHoldings).values({
                    companyId: companyId,
                    ticker: asset.ticker,
                    name: asset.name,
                    type: asset.type,
                    quantity: quantity.toString(),
                    avgCost: asset.price,
                });
            }
            return { success: `L'entreprise a acheté ${quantity} de ${ticker}.` };
        });

        revalidatePath(`/companies`, 'layout');
        return result;
    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat de l'actif." };
    }
}

export async function sellAssetForCompany(companyId: number, holdingId: number, quantity: number): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: "Non autorisé." };
    if (quantity <= 0) return { error: "La quantité doit être positive." };

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer les actifs de l'entreprise.");

            const holdingToSell = await tx.query.companyHoldings.findFirst({
                where: and(eq(companyHoldings.id, holdingId), eq(companyHoldings.companyId, companyId))
            });

            if (!holdingToSell) throw new Error("Actif détenu non trouvé.");
            if (parseFloat(holdingToSell.quantity) < quantity) throw new Error("Quantité d'actifs de l'entreprise insuffisante pour la vente.");
            
            const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, holdingToSell.ticker) });
            if (!asset) throw new Error("Actif non trouvé sur le marché.");

            const tradeValue = parseFloat(asset.price) * quantity;
            
            await tx.update(companies).set({ cash: sql`${companies.cash} + ${tradeValue}` }).where(eq(companies.id, companyId));

            const newQuantity = parseFloat(holdingToSell.quantity) - quantity;
            if (newQuantity > 1e-9) {
                await tx.update(companyHoldings).set({ quantity: newQuantity.toString(), updatedAt: new Date() }).where(eq(companyHoldings.id, holdingId));
            } else {
                await tx.delete(companyHoldings).where(eq(companyHoldings.id, holdingId));
            }
            return { success: `L'entreprise a vendu ${quantity} de ${asset.ticker}.` };
        });

        revalidatePath(`/companies`, 'layout');
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de la vente de l'actif." };
    }
}

export async function buyMiningRigForCompany(companyId: number, rigId: string): Promise<{ success?: string; error?: string }> {
    const session = await getSession();
    if (!session?.id) return { error: 'Non autorisé.' };

    const rigToBuy = getRigById(rigId);
    if (!rigToBuy) {
        return { error: 'Matériel de minage non valide.' };
    }

    try {
        const result = await db.transaction(async (tx) => {
            const member = await tx.query.companyMembers.findFirst({ where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)) });
            if (!member || member.role !== 'ceo') {
                throw new Error("Seul le PDG peut acheter du matériel de minage.");
            }

            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId),
                columns: { cash: true }
            });

            if (!company) {
                throw new Error("Entreprise non trouvée.");
            }

            if (parseFloat(company.cash) < rigToBuy.price) {
                throw new Error("Trésorerie de l'entreprise insuffisante.");
            }

            // Deduct cost
            const newCash = parseFloat(company.cash) - rigToBuy.price;
            await tx.update(companies).set({ cash: newCash.toFixed(2) }).where(eq(companies.id, companyId));

            // Add or update rig
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

            return { success: `${rigToBuy.name} acheté avec succès pour l'entreprise !` };
        });

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        return { error: error.message || "Une erreur est survenue lors de l'achat." };
    }
}
