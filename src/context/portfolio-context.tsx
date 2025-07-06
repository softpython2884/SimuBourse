'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthenticatedUserProfile, updateUserProfile as updateUserProfileAction, ProfileUpdateInput, buyAssetAction, sellAssetAction } from '@/lib/actions/portfolio';

export interface Asset {
  name: string;
  ticker: string;
  price: number;
  type: 'Stock' | 'Crypto' | 'Commodity' | 'Forex';
}

export interface Holding {
  id: number;
  userId: number;
  ticker: string;
  name: string;
  type: string;
  quantity: number;
  avgCost: number;
  updatedAt: Date;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'Buy' | 'Sell';
  ticker: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  createdAt: Date;
  asset: { name: string, ticker: string };
}

export interface UserProfile {
  id: number;
  displayName: string;
  email: string;
  phoneNumber?: string | null;
  cash: number;
  initialCash: number;
  createdAt: Date;
}

interface PortfolioData extends UserProfile {
    holdings: Holding[];
    transactions: Transaction[];
}

interface PortfolioContextType {
  userProfile: UserProfile | null;
  cash: number;
  initialCash: number;
  holdings: Holding[];
  transactions: Transaction[];
  loading: boolean;
  buyAsset: (asset: Asset, quantity: number) => Promise<void>;
  sellAsset: (asset: Asset, quantity: number) => Promise<void>;
  getHoldingQuantity: (ticker: string) => number;
  updateUserProfile: (data: ProfileUpdateInput) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);
const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setPortfolioData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getAuthenticatedUserProfile();
    if (data) {
      // The data from the server action is already formatted
      setPortfolioData(data);
    } else {
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de charger les données du portefeuille." });
      setPortfolioData(null);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchPortfolio();
    }
  }, [authLoading, fetchPortfolio]);

  const updateUserProfile = async (data: ProfileUpdateInput) => {
    const result = await updateUserProfileAction(data);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else {
      toast({ title: 'Succès', description: 'Profil mis à jour !' });
      await fetchPortfolio(); // Refresh data
    }
  };

  const buyAsset = async (asset: Asset, quantity: number) => {
    const result = await buyAssetAction(asset, quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: "Échec de l'achat", description: result.error });
    } else {
      toast({ title: 'Succès', description: result.success });
      await fetchPortfolio();
    }
  }

  const sellAsset = async (asset: Asset, quantity: number) => {
    const result = await sellAssetAction(asset, quantity);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Échec de la vente', description: result.error });
    } else {
      toast({ title: 'Succès', description: result.success });
      await fetchPortfolio();
    }
  }

  const getHoldingQuantity = (ticker: string) => {
    const holding = portfolioData?.holdings.find(h => h.ticker === ticker);
    return holding ? holding.quantity : 0;
  };

  const value = {
    userProfile: portfolioData,
    cash: portfolioData?.cash ?? 0,
    initialCash: portfolioData?.initialCash ?? INITIAL_CASH,
    holdings: portfolioData?.holdings ?? [],
    transactions: portfolioData?.transactions ?? [],
    loading: authLoading || loading,
    buyAsset, sellAsset, getHoldingQuantity, updateUserProfile
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
