
'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { companies, companyMembers, users, companyShares, companyHoldings, assets as assetsSchema, companyMiningRigs } from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, or, ilike, notInArray } from 'drizzle-orm';
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
  const ticker = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();

  try {
    const result = await db.transaction(async (tx) => {
      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");
      
      const userCash = parseFloat(user.cash);
      if (userCash < creationCost) throw new Error(`Fonds insuffisants. La création d'une entreprise coûte ${creationCost.toLocaleString()}$.`);

      const existingTicker = await tx.query.companies.findFirst({ where: eq(companies.ticker, ticker) });
      if (existingTicker) {
        throw new Error("Une entreprise avec un ticker similaire existe déjà. Veuillez choisir un nom légèrement différent.");
      }

      await tx.update(users).set({ cash: (userCash - creationCost).toFixed(2) }).where(eq(users.id, session.id));

      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
        cash: creationCost.toFixed(2),
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
      });

      return { success: `L'entreprise "${name}" a été créée avec succès ! ${creationCost.toLocaleString()}$ ont été transférés à la trésorerie.` };
    });

    revalidatePath('/companies');
    revalidatePath('/portfolio');
    revalidatePath('/profile');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    if (error?.code === '23505' && error.constraint === 'companies_name_key') {
        return { error: "Une entreprise avec ce nom existe déjà." };
    }
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

    const sharesByCompanyId = new Map(userShares.map(s => [s.companyId, s]));
    const membershipsByCompanyId = new Map(userMemberships.map(m => [m.companyId, m]));

    const managedCompanies: any[] = [];
    const investedCompanies: any[] = [];
    const otherCompanies: any[] = [];

    for (const company of companiesWithMarketData) {
        const membership = membershipsByCompanyId.get(company.id);
        const shareData = sharesByCompanyId.get(company.id);
        const sharesHeld = parseFloat(shareData?.quantity || '0');

        if (membership) {
            managedCompanies.push({
                ...company,
                role: membership.role,
                sharesHeld: sharesHeld,
                sharesValue: sharesHeld * company.sharePrice,
            });
        } else if (shareData) {
            investedCompanies.push({
                ...company,
                sharesHeld: sharesHeld,
                sharesValue: sharesHeld * company.sharePrice,
            });
        } else {
            otherCompanies.push(company);
        }
    }

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
    
    // Calculate offline mining gains
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
    
    // Calculate market cap based on the stored share price, not NAV
    const sharePrice = parseFloat(company.sharePrice);
    const totalShares = parseFloat(company.totalShares);
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

            const companyData = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
            if (!companyData || companyData.isListed) throw new Error("L'investissement direct n'est possible que pour les entreprises non cotées.");
            
            const sharePrice = parseFloat(companyData.sharePrice);
            const totalShares = parseFloat(companyData.totalShares);
            const companyCash = parseFloat(companyData.cash);

            if (amount <= 0) throw new Error("Le montant de l'investissement doit être positif.");

            const sharesToBuy = amount / sharePrice;
            const newCompanyCash = companyCash + amount;
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
            
            return { success: `Vous avez investi ${amount.toFixed(2)}$ dans ${companyData.name} !` };
        });

        revalidatePath(`/companies`);
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

    try {
        const result = await db.transaction(async (tx) => {
            const company = await tx.query.companies.findFirst({
                where: eq(companies.id, companyId)
            });
            if (!company) throw new Error("Entreprise non trouvée.");
            if (company.isListed) throw new Error("Les actions des entreprises cotées doivent être vendues sur le marché.");

            const sharePrice = parseFloat(company.sharePrice);
            if (quantity <= 0) throw new Error("La quantité doit être positive.");

            const userShareHolding = await tx.query.companyShares.findFirst({
                where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId))
            });
            const sharesHeld = parseFloat(userShareHolding?.quantity || '0');
            if (sharesHeld < quantity) throw new Error("Vous ne possédez pas assez de parts.");
            
            const proceeds = sharePrice * quantity;
            const companyCash = parseFloat(company.cash);
            if(companyCash < proceeds) throw new Error("La trésorerie de l'entreprise est insuffisante pour racheter ces parts.");

            const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
            if (!user) throw new Error("Utilisateur non trouvé.");
            
            const newTotalShares = parseFloat(company.totalShares) - quantity;

            await tx.update(users).set({ cash: (parseFloat(user.cash) + proceeds).toFixed(2) }).where(eq(users.id, session.id));
            await tx.update(companies).set({ 
                cash: (companyCash - proceeds).toFixed(2),
                totalShares: newTotalShares.toString(),
            }).where(eq(companies.id, companyId));

            const newSharesHeld = sharesHeld - quantity;
            if (newSharesHeld < 1e-9) {
                await tx.delete(companyShares).where(eq(companyShares.id, userShareHolding!.id));
            } else {
                await tx.update(companyShares).set({ quantity: newSharesHeld.toString() }).where(eq(companyShares.id, userShareHolding!.id));
            }

            return { success: `Vous avez vendu ${quantity.toFixed(4)} parts de ${company.name} pour ${proceeds.toFixed(2)}$.` };
        });

        revalidatePath('/companies');
        revalidatePath(`/companies/${companyId}`);
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
    if (!session?.id) {
      return { error: 'Non autorisé.' };
    }
  
    try {
      const member = await db.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
  
      if (!member || member.role !== 'ceo') {
        return { error: 'Seul le PDG peut mettre une entreprise en bourse.' };
      }
  
      await db.update(companies).set({ isListed: true }).where(eq(companies.id, companyId));
  
      revalidatePath('/trading');
      revalidatePath(`/companies/${companyId}`);
  
      return { success: 'Entreprise mise en bourse avec succès !' };
    } catch (error: any) {
      return { error: error.message || "Une erreur est survenue." };
    }
}

export async function getListedCompaniesForSimulation() {
    const listedCompanies = await db.query.companies.findMany({
        where: eq(companies.isListed, true),
        with: {
            holdings: {
                columns: {
                    ticker: true,
                    quantity: true,
                }
            },
            miningRigs: {
                columns: {
                    rigId: true,
                    quantity: true,
                }
            }
        }
    });

    return listedCompanies.map(c => {
        const miningRigsValue = c.miningRigs.reduce((total, ownedRig) => {
            const rigData = getRigById(ownedRig.rigId);
            return total + (rigData?.price || 0) * ownedRig.quantity;
        }, 0);

        return {
            ticker: c.ticker,
            cash: parseFloat(c.cash),
            totalShares: parseFloat(c.totalShares),
            unclaimedBtc: parseFloat(c.unclaimedBtc),
            initialSharePrice: parseFloat(c.sharePrice),
            holdings: c.holdings.map(h => ({ ticker: h.ticker, quantity: parseFloat(h.quantity) })),
            miningRigsValue: miningRigsValue,
        };
    });
}
export type CompanyForSimulation = Awaited<ReturnType<typeof getListedCompaniesForSimulation>>[0];

export async function applyMarketImpactToCompany(ticker: string, tradeValue: number) {
    try {
        const company = await db.query.companies.findFirst({
            where: eq(companies.ticker, ticker),
        });

        if (!company) return;

        const currentPrice = parseFloat(company.sharePrice);
        const totalShares = parseFloat(company.totalShares);
        if (currentPrice <= 0 || totalShares <= 0) return;

        const marketCap = currentPrice * totalShares;
        if (marketCap <= 0) return;

        const IMPACT_CONSTANT = 0.02; // Smaller impact than regular stocks
        const impactPercentage = (tradeValue / marketCap) * IMPACT_CONSTANT;
        let newPrice = currentPrice * (1 + impactPercentage);

        if (isNaN(newPrice) || !isFinite(newPrice) || newPrice <= 0) {
            newPrice = currentPrice;
        }

        await db.update(companies)
            .set({ sharePrice: newPrice.toString() })
            .where(eq(companies.ticker, ticker));
        
        revalidatePath('/trading', 'layout');
        revalidatePath('/portfolio');
        revalidatePath('/');
        revalidatePath('/companies', 'layout');

    } catch (error: any) {
        console.error(`Error applying market impact to ${ticker}:`, error);
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
        
        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error selling asset for company:", error);
        return { error: error.message || "Une erreur est survenue lors de la vente." };
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
            if (amountBtc < 1e-9) { // Avoid claiming dust
                throw new Error("Pas assez de BTC à réclamer.");
            }

            const btcAsset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, 'BTC') });
            if (!btcAsset) throw new Error("L'actif BTC n'a pas été trouvé dans le système.");

            const existingHolding = await tx.query.companyHoldings.findFirst({
                where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, 'BTC'))
            });

            if (existingHolding) {
                const newQuantity = parseFloat(existingHolding.quantity) + amountBtc;
                // We don't change the average cost as these are mined "for free" (in-game)
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

            // Reset unclaimed BTC for the company
            await tx.update(companies)
                .set({ unclaimedBtc: '0', lastMiningUpdateAt: new Date() })
                .where(eq(companies.id, companyId));
            
            return { success: `Vous avez réclamé ${amountBtc.toFixed(8)} BTC pour l'entreprise.` };
        });

        revalidatePath(`/companies/${companyId}`);
        return result;

    } catch (error: any) {
        console.error("Error claiming company BTC: ", error);
        // This is a server action called from a form, so we can't easily return the error to a toast.
        // It will fail and the user will see the old value. They can try again.
        // For a better UX, we would need a client component with state management.
        // But for now, this is a safe failure mode.
        // To show an error, we would have to redirect with a query param or similar.
        return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
    }
}
