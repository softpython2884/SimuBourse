'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthenticatedUserProfile, updateUserProfile as updateUserProfileAction, ProfileUpdateInput, buyAssetAction, sellAssetAction, claimMiningRewards } from '@/lib/actions/portfolio';
import { buyMiningRig as buyMiningRigAction } from '@/lib/actions/mining';
import { getRigById } from '@/lib/mining';

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

export interface UserMiningRig {
  id: number;
  userId: number;
  rigId: string;
  quantity: number;
  createdAt: Date;
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
    miningRigs: UserMiningRig[];
}

interface PortfolioContextType {
  userProfile: UserProfile | null;
  cash: number;
  initialCash: number;
  holdings: Holding[];
  transactions: Transaction[];
  miningRigs: UserMiningRig[];
  unclaimedRewards: number;
  totalHashRateMhs: number;
  loading: boolean;
  buyAsset: (asset: Asset, quantity: number) => Promise<void>;
  sellAsset: (asset: Asset, quantity: number) => Promise<void>;
  getHoldingQuantity: (ticker: string) => number;
  updateUserProfile: (data: ProfileUpdateInput) => Promise<void>;
  buyMiningRig: (rigId: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);
const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unclaimedRewards, setUnclaimedRewards] = useState(0);

  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setPortfolioData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getAuthenticatedUserProfile();
    if (data) {
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

  const buyMiningRig = async (rigId: string) => {
    const result = await buyMiningRigAction(rigId);
    if (result.error) {
      toast({ variant: 'destructive', title: "Échec de l'achat", description: result.error });
    }
    if (result.success) {
      toast({ title: "Achat réussi", description: result.success });
      await fetchPortfolio();
    }
  }

  const getHoldingQuantity = (ticker: string) => {
    const holding = portfolioData?.holdings.find(h => h.ticker === ticker);
    return holding ? holding.quantity : 0;
  };
  
  const totalHashRateMhs = portfolioData?.miningRigs.reduce((total, rig) => {
      const rigData = getRigById(rig.rigId);
      return total + (rigData?.hashRateMhs || 0) * rig.quantity;
  }, 0) || 0;

  // This effect will run the mining simulation
  useEffect(() => {
    if (!user || loading || totalHashRateMhs === 0) return;

    const BTC_PER_MHS_PER_SECOND = 7.7e-12;

    const miningInterval = setInterval(() => {
        const earnedThisTick = totalHashRateMhs * BTC_PER_MHS_PER_SECOND;
        setUnclaimedRewards(prev => prev + earnedThisTick);
    }, 1000); // every second

    return () => clearInterval(miningInterval);
  }, [user, loading, totalHashRateMhs]);

  // This effect will periodically claim the rewards to the server
  useEffect(() => {
    if (!user || unclaimedRewards < 1e-9) return; // Don't claim dust

    const claimInterval = setInterval(async () => {
        const rewardsToClaim = unclaimedRewards;
        setUnclaimedRewards(0); // Reset immediately to avoid double claiming
        
        if (rewardsToClaim > 0) {
            const result = await claimMiningRewards(rewardsToClaim);
            if (result.success) {
                // Don't toast on success to avoid spamming notifications
                await fetchPortfolio(); // Refresh portfolio data
            } else if (result.error) {
                // If claim fails, add it back to be reclaimed next time
                setUnclaimedRewards(prev => prev + rewardsToClaim);
                toast({ variant: 'destructive', title: "Erreur de Minage", description: result.error });
            }
        }
    }, 30000); // Claim every 30 seconds

    return () => clearInterval(claimInterval);
  }, [user, unclaimedRewards, fetchPortfolio, toast]);

  const value = {
    userProfile: portfolioData,
    cash: portfolioData?.cash ?? 0,
    initialCash: portfolioData?.initialCash ?? INITIAL_CASH,
    holdings: portfolioData?.holdings ?? [],
    transactions: portfolioData?.transactions ?? [],
    miningRigs: portfolioData?.miningRigs ?? [],
    unclaimedRewards,
    totalHashRateMhs,
    loading: authLoading || loading,
    buyAsset, sellAsset, getHoldingQuantity, updateUserProfile, buyMiningRig
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
