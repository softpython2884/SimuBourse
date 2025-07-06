'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthenticatedUserProfile, updateUserProfile as updateUserProfileAction, ProfileUpdateInput } from '@/lib/actions/portfolio';

export interface Asset {
  name: string;
  ticker: string;
  price: number;
  type: 'Stock' | 'Crypto' | 'Commodity' | 'Forex';
}

export interface Holding {
  ticker: string;
  quantity: number;
  avgCost: number;
  name: string;
  type: 'Stock' | 'Crypto' | 'Commodity' | 'Forex';
}

export interface Transaction {
  type: 'Buy' | 'Sell';
  asset: { name: string, ticker: string };
  quantity: number;
  price: number;
  value: number;
  date: string;
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

interface PortfolioContextType {
  userProfile: UserProfile | null;
  cash: number;
  initialCash: number;
  holdings: Holding[];
  transactions: Transaction[];
  loading: boolean;
  buyAsset: (asset: Asset, quantity: number) => void;
  sellAsset: (asset: Asset, quantity: number) => void;
  getHoldingQuantity: (ticker: string) => number;
  updateUserProfile: (data: ProfileUpdateInput) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);
const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }
    
    const profile = await getAuthenticatedUserProfile();
    if (profile) {
      setUserProfile(profile as UserProfile);
    } else {
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de charger les données du profil." });
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
  
  // Placeholder logic for now
  const holdings: Holding[] = [];
  const transactions: Transaction[] = [];
  const buyAsset = () => toast({ variant: 'destructive', title: 'Action indisponible', description: 'La fonctionnalité de trading sera bientôt réactivée.' });
  const sellAsset = () => toast({ variant: 'destructive', title: 'Action indisponible', description: 'La fonctionnalité de trading sera bientôt réactivée.' });
  const getHoldingQuantity = () => 0;

  const value = {
    userProfile,
    cash: userProfile?.cash ?? 0,
    initialCash: userProfile?.initialCash ?? INITIAL_CASH,
    holdings,
    transactions,
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
