'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { runTransaction } from '@/lib/db/tx';
import {
  companies, companyMembers, users, companyShares, companyHoldings,
  assets as assetsSchema, transactions, companyMiningRigs, companyTransactions,
} from '@/lib/db/schema';
import { getSession } from '../session';
import { revalidatePath } from 'next/cache';
import { eq, and, desc, or, like, notInArray, inArray, sql } from 'drizzle-orm';
import { getRigById } from '@/lib/mining';

const BTC_PER_MHS_PER_SECOND = 7.7e-12;
const CREATION_COST = 1000;
const INITIAL_SHARES = 1000;

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
  while (!isUnique && attempt < 10) {
    const existingTicker = await db.query.companies.findFirst({ where: eq(companies.ticker, ticker) });
    if (!existingTicker) {
      isUnique = true;
    } else {
      ticker = ticker.substring(0, 3) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
      attempt++;
    }
  }
  if (!isUnique) return { error: "Impossible de générer un ticker unique. Veuillez essayer un autre nom." };

  try {
    const result = await runTransaction(async (tx) => {
      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");

      if (user.cash < CREATION_COST) {
        throw new Error(`Fonds insuffisants. La création d'une entreprise coûte ${CREATION_COST.toLocaleString()}$.`);
      }

      await tx.update(users).set({ cash: sql`cash - ${CREATION_COST}` }).where(eq(users.id, session.id));

      const [newCompany] = await tx.insert(companies).values({
        name,
        industry,
        description,
        creatorId: session.id,
        cash: CREATION_COST,
        totalShares: INITIAL_SHARES,
        sharePrice: 1.0,
        ticker,
      }).returning();

      await tx.insert(companyMembers).values({
        companyId: newCompany.id,
        userId: session.id,
        role: 'ceo',
      });

      await tx.insert(companyShares).values({
        companyId: newCompany.id,
        userId: session.id,
        quantity: INITIAL_SHARES,
        avgCost: 1.0,
      });

      return { success: `L'entreprise "${name}" a été créée avec succès ! ${CREATION_COST.toLocaleString()}$ ont été transférés à la trésorerie.` };
    });

    revalidatePath('/companies');
    revalidatePath('/portfolio');
    revalidatePath('/profile');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    if (typeof error?.message === 'string' && /UNIQUE constraint/i.test(error.message)) {
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

  // Single batch fetch: companies + their holdings + miningRigs to compute NAV in JS.
  // Replaces the original N+1 loop that ran 4+ queries per company.
  const allCompanies = await db.query.companies.findMany({
    orderBy: (c, { desc: d }) => [d(c.createdAt)],
    with: { holdings: true, miningRigs: true },
  });

  // Pre-fetch the entire asset table once for NAV math (we have ~40 assets,
  // it's cheaper than per-company lookups).
  const allAssets = await db.query.assets.findMany();
  const priceByTicker = new Map(allAssets.map(a => [a.ticker, a.price]));
  const btcPrice = priceByTicker.get('BTC') ?? 0;

  const navById = new Map<number, number>();
  const sharePriceById = new Map<number, number>();
  const updates: Array<{ id: number; newPrice: number }> = [];

  for (const c of allCompanies) {
    const holdingsValue = c.holdings.reduce((sum, h) => sum + (priceByTicker.get(h.ticker) ?? 0) * h.quantity, 0);
    const rigsValue = c.miningRigs.reduce((sum, r) => sum + (getRigById(r.rigId)?.price ?? 0) * r.quantity, 0);
    const unclaimedBtcValue = c.unclaimedBtc * btcPrice;
    const nav = c.cash + holdingsValue + rigsValue + unclaimedBtcValue;
    const newSharePrice = c.totalShares > 0 ? nav / c.totalShares : 0;

    navById.set(c.id, nav);
    sharePriceById.set(c.id, newSharePrice);

    if (Math.abs(newSharePrice - c.sharePrice) > 1e-9) {
      updates.push({ id: c.id, newPrice: newSharePrice });
    }
  }

  if (updates.length > 0) {
    await runTransaction(async (tx) => {
      for (const u of updates) {
        await tx.update(companies).set({ sharePrice: u.newPrice }).where(eq(companies.id, u.id));
      }
    });
  }

  const companiesWithMarketData = allCompanies.map((c) => {
    const sharePrice = sharePriceById.get(c.id) ?? c.sharePrice;
    const totalShares = c.totalShares;

    // Synthesize a synthetic 24h history for charts. (For an actual price history
    // we'd need a separate snapshot table; deferred to a later phase.)
    const historicalData: CompanyHistoricalPoint[] = [];
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    let lastPrice = sharePrice / (1 + (Math.random() - 0.45) * 0.1);
    for (let i = 0; i < 24; i++) {
      const date = new Date(yesterday.getTime() + i * 60 * 60 * 1000);
      lastPrice *= 1 + (Math.random() - 0.5) * 0.05;
      if (lastPrice <= 0) lastPrice = 0.0001;
      historicalData.push({ date: date.toISOString(), price: lastPrice });
    }
    historicalData.push({ date: now.toISOString(), price: sharePrice });

    const startPrice = historicalData[0]?.price ?? sharePrice;
    const change = sharePrice - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;
    const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

    return {
      ...c,
      cash: c.cash,
      marketCap: totalShares * sharePrice,
      sharePrice,
      totalShares,
      historicalData,
      change24h,
    };
  });

  const allListedCompanies = companiesWithMarketData.filter(c => c.isListed);

  if (!session?.id) {
    const privateCompanies = companiesWithMarketData.filter(c => !c.isListed);
    return {
      managedCompanies: [] as Array<typeof companiesWithMarketData[number] & { sharesHeld: number; sharesValue: number; role: 'ceo' | 'manager' | 'member' | undefined }>,
      investedCompanies: [] as Array<typeof companiesWithMarketData[number] & { sharesHeld: number; sharesValue: number; role: 'ceo' | 'manager' | 'member' | undefined }>,
      otherPrivateCompanies: privateCompanies,
      listedCompanies: allListedCompanies.map(c => ({ ...c, sharesHeld: 0 })),
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

  const privateCompanies = companiesWithMarketData.filter(c => !c.isListed);
  const allRelatedCompanyIds = new Set([...sharesByCompanyId.keys(), ...membershipsByCompanyId.keys()]);

  for (const companyId of allRelatedCompanyIds) {
    const company = companiesWithMarketData.find(c => c.id === companyId);
    if (!company) continue;

    const membership = membershipsByCompanyId.get(companyId);
    const shareData = sharesByCompanyId.get(companyId);
    const sharesHeld = shareData?.quantity ?? 0;

    const companyData = {
      ...company,
      sharesHeld,
      sharesValue: sharesHeld * company.sharePrice,
      role: membership?.role,
    };

    if (membership) {
      managedCompanies.push(companyData);
    } else if (sharesHeld > 0 && !company.isListed) {
      investedCompanies.push(companyData);
    }
  }

  const otherPrivateCompanies = privateCompanies.filter(c => !allRelatedCompanyIds.has(c.id));

  const listedCompaniesWithShares = allListedCompanies.map(company => ({
    ...company,
    sharesHeld: sharesByCompanyId.get(company.id)?.quantity ?? 0,
  }));

  return { managedCompanies, investedCompanies, otherPrivateCompanies, listedCompanies: listedCompaniesWithShares };
}

export type ManagedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['managedCompanies'][0];
export type InvestedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['investedCompanies'][0];
export type OtherCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['otherPrivateCompanies'][0];
export type ListedCompany = Awaited<ReturnType<typeof getCompaniesForUserDashboard>>['listedCompanies'][0];


export async function getCompanyById(companyId: number) {
  try {
    // Atomically accrue any mining yield earned since last update.
    const company0 = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      columns: { id: true },
      with: { miningRigs: true },
    });
    if (company0 && company0.miningRigs.length > 0) {
      const hash = company0.miningRigs.reduce((sum, r) => sum + (getRigById(r.rigId)?.hashRateMhs ?? 0) * r.quantity, 0);
      if (hash > 0) {
        const now = Date.now();
        const rate = hash * BTC_PER_MHS_PER_SECOND;
        await db.update(companies).set({
          unclaimedBtc: sql`unclaimed_btc + ((${now} - last_mining_update_at) / 1000.0) * ${rate}`,
          lastMiningUpdateAt: new Date(now),
        }).where(eq(companies.id, companyId));
      }
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      with: {
        creator: { columns: { displayName: true } },
        members: {
          with: { user: { columns: { displayName: true, id: true } } },
          orderBy: (companyMembers, { asc }) => [asc(companyMembers.id)],
        },
        shares: {
          with: { user: { columns: { displayName: true, id: true } } },
          orderBy: (companyShares, { desc }) => [desc(companyShares.quantity)],
        },
        holdings: {
          orderBy: (companyHoldings, { desc }) => [desc(companyHoldings.updatedAt)],
        },
        miningRigs: true,
        transactions: {
          orderBy: [desc(companyTransactions.createdAt)],
          limit: 20,
        },
      },
    });

    if (!company) return null;

    const nav = await getCompanyNAV(companyId, db);
    const totalShares = company.totalShares;
    const sharePrice = totalShares > 0 ? nav / totalShares : 0;
    const marketCap = sharePrice * totalShares;

    const miningRigsValue = company.miningRigs.reduce((total, ownedRig) => {
      const rigData = getRigById(ownedRig.rigId);
      return total + (rigData?.price || 0) * ownedRig.quantity;
    }, 0);

    const formattedTransactions = company.transactions.map(tx => ({
      ...tx,
      quantity: tx.quantity,
      price: tx.price,
      value: tx.value,
      createdAt: new Date(tx.createdAt),
    }));

    return {
      ...company,
      cash: company.cash,
      sharePrice,
      totalShares,
      marketCap,
      miningRigsValue,
      unclaimedBtc: company.unclaimedBtc,
      transactions: formattedTransactions,
      shares: company.shares,
      holdings: company.holdings,
      miningRigs: company.miningRigs,
    };
  } catch (error) {
    console.error("Error fetching company by ID:", error);
    return null;
  }
}

export type CompanyWithDetails = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;

export async function getCompanyNAV(companyId: number, tx: any): Promise<number> {
  const company = await tx.query.companies.findFirst({
    where: eq(companies.id, companyId),
    with: { holdings: true, miningRigs: true },
  });
  if (!company) throw new Error("Entreprise non trouvée pour le calcul de la NAV.");

  const holdingTickers = company.holdings.map((h: any) => h.ticker);
  const marketAssetPrices = new Map<string, number>();

  if (holdingTickers.length > 0) {
    const marketAssets = await tx.query.assets.findMany({
      where: inArray(assetsSchema.ticker, holdingTickers),
    });
    for (const a of marketAssets) marketAssetPrices.set(a.ticker, a.price);
  }

  const holdingsValue = company.holdings.reduce((sum: number, h: any) => {
    const price = marketAssetPrices.get(h.ticker) ?? 0;
    return sum + price * h.quantity;
  }, 0);

  const miningRigsValue = company.miningRigs.reduce((sum: number, r: any) => {
    return sum + (getRigById(r.rigId)?.price ?? 0) * r.quantity;
  }, 0);

  const btcAsset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, 'BTC'), columns: { price: true } });
  const btcPrice = btcAsset?.price ?? 0;
  const unclaimedBtcValue = company.unclaimedBtc * btcPrice;

  return company.cash + holdingsValue + miningRigsValue + unclaimedBtcValue;
}

const amountSchema = z.number().positive().finite().max(1e12);
const quantitySchema = z.number().positive().finite().max(1e12);

export async function investInCompany(companyId: number, amount: number): Promise<{ success?: string; error?: string }> {
  const session = await getSession();
  if (!session?.id) return { error: "Vous devez être connecté pour investir." };

  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return { error: "Montant invalide." };

  try {
    const result = await runTransaction(async (tx) => {
      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");
      if (user.cash < amount) throw new Error("Fonds insuffisants.");

      const companyData = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
      if (!companyData) throw new Error("Entreprise non trouvée.");

      const currentNav = await getCompanyNAV(companyId, tx);
      const currentTotalShares = companyData.totalShares;
      const sharePrice = currentTotalShares > 0 ? currentNav / currentTotalShares : 1;

      if (sharePrice <= 0) throw new Error("Prix de l'action non valide, impossible d'investir.");

      const sharesToBuy = amount / sharePrice;

      await tx.update(users).set({ cash: sql`cash - ${amount}` }).where(eq(users.id, session.id));

      const existingShares = await tx.query.companyShares.findFirst({
        where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId)),
      });

      if (existingShares) {
        await tx.update(companyShares).set({
          quantity: sql`quantity + ${sharesToBuy}`,
          avgCost: sql`((avg_cost * quantity) + ${amount}) / (quantity + ${sharesToBuy})`,
        }).where(eq(companyShares.id, existingShares.id));
      } else {
        await tx.insert(companyShares).values({
          userId: session.id,
          companyId,
          quantity: sharesToBuy,
          avgCost: sharePrice,
        });
      }

      await tx.update(companies).set({
        cash: sql`cash + ${amount}`,
        totalShares: sql`total_shares + ${sharesToBuy}`,
        sharePrice,
      }).where(eq(companies.id, companyId));

      await tx.insert(transactions).values({
        userId: session.id,
        type: 'Buy',
        ticker: companyData.ticker,
        name: companyData.name,
        quantity: sharesToBuy,
        price: sharePrice,
        value: amount,
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

  const parsed = quantitySchema.safeParse(quantity);
  if (!parsed.success) return { error: "Quantité invalide." };

  try {
    const result = await runTransaction(async (tx) => {
      const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
      if (!company) throw new Error("Entreprise non trouvée.");

      const userShareHolding = await tx.query.companyShares.findFirst({
        where: and(eq(companyShares.userId, session.id), eq(companyShares.companyId, companyId)),
      });
      const sharesHeld = userShareHolding?.quantity ?? 0;
      if (sharesHeld < quantity) throw new Error("Vous ne possédez pas assez de parts.");

      const currentNav = await getCompanyNAV(companyId, tx);
      const currentTotalShares = company.totalShares;
      const sharePrice = currentTotalShares > 0 ? currentNav / currentTotalShares : 0;
      const proceeds = sharePrice * quantity;

      if (company.cash < proceeds && !company.isListed) {
        throw new Error("La trésorerie de l'entreprise est insuffisante pour racheter vos parts.");
      }

      await tx.update(users).set({ cash: sql`cash + ${proceeds}` }).where(eq(users.id, session.id));

      const newSharesHeld = sharesHeld - quantity;
      if (newSharesHeld < 1e-9) {
        await tx.delete(companyShares).where(eq(companyShares.id, userShareHolding!.id));
      } else {
        await tx.update(companyShares).set({ quantity: newSharesHeld }).where(eq(companyShares.id, userShareHolding!.id));
      }

      // Private company buys back its own shares; listed company is unaffected.
      if (!company.isListed) {
        await tx.update(companies).set({
          cash: sql`cash - ${proceeds}`,
          totalShares: sql`total_shares - ${quantity}`,
          sharePrice,
        }).where(eq(companies.id, companyId));
      } else {
        await tx.update(companies).set({ sharePrice }).where(eq(companies.id, companyId));
      }

      await tx.insert(transactions).values({
        userId: session.id,
        type: 'Sell',
        ticker: company.ticker,
        name: company.name,
        quantity,
        price: sharePrice,
        value: proceeds,
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
  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return { error: "Montant invalide." };

  try {
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut ajouter des fonds à la trésorerie.");

      const user = await tx.query.users.findFirst({ where: eq(users.id, session.id), columns: { cash: true } });
      if (!user) throw new Error("Utilisateur non trouvé.");
      if (user.cash < amount) throw new Error("Fonds personnels insuffisants.");

      await tx.update(users).set({ cash: sql`cash - ${amount}` }).where(eq(users.id, session.id));
      await tx.update(companies).set({ cash: sql`cash + ${amount}` }).where(eq(companies.id, companyId));

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
  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return { error: "Montant invalide." };

  try {
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut retirer des fonds de la trésorerie.");

      const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
      if (!company) throw new Error("Entreprise non trouvée.");
      if (company.cash < amount) throw new Error("Trésorerie de l'entreprise insuffisante.");

      await tx.update(companies).set({ cash: sql`cash - ${amount}` }).where(eq(companies.id, companyId));
      await tx.update(users).set({ cash: sql`cash + ${amount}` }).where(eq(users.id, session.id));

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

export async function searchUsersForCompany(companyId: number, query: string): Promise<{ id: number, displayName: string, email: string }[]> {
  if (!query || query.length < 2) return [];

  const existingMembers = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
    columns: { userId: true },
  });
  const existingMemberIds = existingMembers.map(m => m.userId);

  // SQLite's LIKE is case-insensitive for ASCII by default, so we don't need ilike (which is Postgres-only).
  const potentialUsers = await db.query.users.findMany({
    where: and(
      notInArray(users.id, existingMemberIds.length > 0 ? existingMemberIds : [0]),
      or(
        like(users.displayName, `%${query}%`),
        like(users.email, `%${query.toLowerCase()}%`),
      ),
    ),
    limit: 5,
    columns: { id: true, displayName: true, email: true },
  });

  return potentialUsers;
}

export async function addMemberToCompany(companyId: number, userId: number, role: 'manager' | 'member'): Promise<{ success?: string; error?: string }> {
  const session = await getSession();
  if (!session?.id) return { error: "Non autorisé." };

  try {
    const result = await runTransaction(async (tx) => {
      const requesterMember = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!requesterMember || requesterMember.role !== 'ceo') throw new Error("Seul le PDG peut ajouter des membres.");

      const alreadyMember = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)),
      });
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
    const result = await runTransaction(async (tx) => {
      const requesterMember = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!requesterMember || requesterMember.role !== 'ceo') throw new Error("Seul le PDG peut supprimer des membres.");

      const memberToRemove = await tx.query.companyMembers.findFirst({
        where: eq(companyMembers.id, memberIdToRemove),
        with: { user: { columns: { displayName: true } } },
      });
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
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error('Seul le PDG peut mettre une entreprise en bourse.');

      const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
      if (!company) throw new Error("Entreprise non trouvée.");
      if (company.isListed) throw new Error("L'entreprise est déjà cotée.");

      await tx.update(companies).set({ isListed: true }).where(eq(companies.id, companyId));
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
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut réclamer les récompenses de minage.");

      const company = await tx.query.companies.findFirst({
        where: eq(companies.id, companyId),
        columns: { unclaimedBtc: true, lastMiningUpdateAt: true },
        with: { miningRigs: true },
      });
      if (!company) throw new Error("Entreprise non trouvée.");

      // Server-authoritative accrual.
      const hash = company.miningRigs.reduce((sum, r) => sum + (getRigById(r.rigId)?.hashRateMhs ?? 0) * r.quantity, 0);
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - new Date(company.lastMiningUpdateAt).getTime()) / 1000);
      const accrued = hash * BTC_PER_MHS_PER_SECOND * elapsedSec;
      const total = company.unclaimedBtc + accrued;

      if (total < 1e-9) throw new Error("Pas assez de BTC à réclamer.");

      const existingHolding = await tx.query.companyHoldings.findFirst({
        where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, 'BTC')),
      });

      if (existingHolding) {
        await tx.update(companyHoldings)
          .set({ quantity: sql`quantity + ${total}`, updatedAt: new Date() })
          .where(eq(companyHoldings.id, existingHolding.id));
      } else {
        await tx.insert(companyHoldings).values({
          companyId,
          ticker: 'BTC',
          name: 'Bitcoin',
          type: 'Crypto',
          quantity: total,
          avgCost: 0,
        });
      }

      await tx.update(companies).set({ unclaimedBtc: 0, lastMiningUpdateAt: new Date(now) }).where(eq(companies.id, companyId));
      return total;
    });

    revalidatePath(`/companies/${companyId}`);
    return { success: `Vous avez réclamé ${result.toFixed(8)} BTC pour l'entreprise.` };
  } catch (error: any) {
    console.error("Error claiming company BTC: ", error);
    return { error: error.message || "Une erreur est survenue lors de la réclamation des récompenses." };
  }
}

const tickerSchema = z.string().min(1).max(20).regex(/^[A-Z0-9]+$/i);

export async function buyAssetForCompany(companyId: number, ticker: string, quantity: number): Promise<{ success?: string; error?: string }> {
  const session = await getSession();
  if (!session?.id) return { error: "Non autorisé." };

  const t = tickerSchema.safeParse(ticker);
  const q = quantitySchema.safeParse(quantity);
  if (!t.success || !q.success) return { error: "Données invalides." };
  const tickerUp = t.data.toUpperCase();

  try {
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer les actifs de l'entreprise.");

      const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { cash: true } });
      if (!company) throw new Error("Entreprise non trouvée.");

      const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, tickerUp) });
      if (!asset) throw new Error("Actif à acheter non trouvé.");

      const currentPrice = asset.price;
      const tradeValue = currentPrice * q.data;
      if (company.cash < tradeValue) throw new Error("Trésorerie de l'entreprise insuffisante.");

      await tx.update(companies).set({ cash: sql`cash - ${tradeValue}` }).where(eq(companies.id, companyId));

      const existingHolding = await tx.query.companyHoldings.findFirst({
        where: and(eq(companyHoldings.companyId, companyId), eq(companyHoldings.ticker, tickerUp)),
      });

      if (existingHolding) {
        await tx.update(companyHoldings).set({
          quantity: sql`quantity + ${q.data}`,
          avgCost: sql`((avg_cost * quantity) + ${tradeValue}) / (quantity + ${q.data})`,
          updatedAt: new Date(),
        }).where(eq(companyHoldings.id, existingHolding.id));
      } else {
        await tx.insert(companyHoldings).values({
          companyId,
          ticker: asset.ticker,
          name: asset.name,
          type: asset.type,
          quantity: q.data,
          avgCost: currentPrice,
        });
      }

      await tx.insert(companyTransactions).values({
        companyId,
        type: 'Buy',
        ticker: asset.ticker,
        name: asset.name,
        quantity: q.data,
        price: currentPrice,
        value: tradeValue,
      });

      return { success: `L'entreprise a acheté ${q.data} de ${tickerUp}.` };
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
  const q = quantitySchema.safeParse(quantity);
  if (!q.success) return { error: "Quantité invalide." };

  try {
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut gérer les actifs de l'entreprise.");

      const holdingToSell = await tx.query.companyHoldings.findFirst({
        where: and(eq(companyHoldings.id, holdingId), eq(companyHoldings.companyId, companyId)),
      });

      if (!holdingToSell) throw new Error("Actif détenu non trouvé.");
      if (holdingToSell.quantity < q.data) throw new Error("Quantité d'actifs de l'entreprise insuffisante pour la vente.");

      const asset = await tx.query.assets.findFirst({ where: eq(assetsSchema.ticker, holdingToSell.ticker) });
      if (!asset) throw new Error("Actif non trouvé sur le marché.");

      const currentPrice = asset.price;
      const tradeValue = currentPrice * q.data;

      await tx.update(companies).set({ cash: sql`cash + ${tradeValue}` }).where(eq(companies.id, companyId));

      const newQuantity = holdingToSell.quantity - q.data;
      if (newQuantity > 1e-9) {
        await tx.update(companyHoldings).set({ quantity: newQuantity, updatedAt: new Date() }).where(eq(companyHoldings.id, holdingId));
      } else {
        await tx.delete(companyHoldings).where(eq(companyHoldings.id, holdingId));
      }

      await tx.insert(companyTransactions).values({
        companyId,
        type: 'Sell',
        ticker: asset.ticker,
        name: asset.name,
        quantity: q.data,
        price: currentPrice,
        value: tradeValue,
      });

      return { success: `L'entreprise a vendu ${q.data} de ${asset.ticker}.` };
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
  if (!rigToBuy) return { error: 'Matériel de minage non valide.' };

  try {
    const result = await runTransaction(async (tx) => {
      const member = await tx.query.companyMembers.findFirst({
        where: and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, session.id)),
      });
      if (!member || member.role !== 'ceo') throw new Error("Seul le PDG peut acheter du matériel de minage.");

      const company = await tx.query.companies.findFirst({
        where: eq(companies.id, companyId),
        columns: { cash: true },
      });
      if (!company) throw new Error("Entreprise non trouvée.");
      if (company.cash < rigToBuy.price) throw new Error("Trésorerie de l'entreprise insuffisante.");

      await tx.update(companies).set({ cash: sql`cash - ${rigToBuy.price}` }).where(eq(companies.id, companyId));

      const existingRig = await tx.query.companyMiningRigs.findFirst({
        where: and(eq(companyMiningRigs.companyId, companyId), eq(companyMiningRigs.rigId, rigId)),
      });

      if (existingRig) {
        await tx.update(companyMiningRigs)
          .set({ quantity: existingRig.quantity + 1 })
          .where(eq(companyMiningRigs.id, existingRig.id));
      } else {
        await tx.insert(companyMiningRigs).values({
          companyId,
          rigId,
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
