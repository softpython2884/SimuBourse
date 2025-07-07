'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthenticatedUserProfile, updateUserProfile as updateUserProfileAction, ProfileUpdateInput, buyAssetAction, sellAssetAction, claimMiningRewards as claimMiningRewardsAction, toggleAutoTraderStatus } from '@/lib/actions/portfolio';
import { buyMiningRig as buyMiningRigAction } from '@/lib/actions/mining';
import { getRigById } from '@/lib/mining';
import { useMarketData } from './market-data-context';
import { getAiTradingActions } from '@/lib/actions/autotrader';

export interface Holding {
  id: number;
  userId: number;
  ticker: string;
  name: string;
  type: string;
  quantity: number;
  avgCost: number;
  updatedAt: Date;
  isCompanyShare: boolean;
  company?: {
      id: number;
      name: string;
      ticker: string;
      isListed: boolean;
      sharePrice: number;
  } | null;
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
  unclaimedBtc: number;
  createdAt: Date;
  isAutoTraderEnabled: boolean;
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
  isAutoTraderEnabled: boolean;
  buyAsset: (ticker: string, quantity: number, stopLoss?: number, takeProfit?: number, showToast?: boolean) => Promise<void>;
  sellAsset: (ticker: string, quantity: number, showToast?: boolean) => Promise<void>;
  getHoldingQuantity: (ticker: string) => number;
  updateUserProfile: (data: ProfileUpdateInput) => Promise<void>;
  buyMiningRig: (rigId: string) => Promise<void>;
  claimRewardsNow: () => Promise<void>;
  toggleAutoTrader: (isEnabled: boolean) => Promise<void>;
  refreshPortfolio: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);
const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const market = useMarketData();
  const { toast } = useToast();

  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unclaimedRewards, setUnclaimedRewards] = useState(0);
  const [isAutoTraderEnabled, setIsAutoTraderEnabled] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setPortfolioData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getAuthenticatedUserProfile();
    if (data) {
      setPortfolioData(data as any);
      setUnclaimedRewards(data.unclaimedBtc);
      setIsAutoTraderEnabled(data.isAutoTraderEnabled);
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

  const buyAsset = useCallback(async (ticker: string, quantity: number, stopLoss?: number, takeProfit?: number, showToast = true) => {
    const result = await buyAssetAction(ticker, quantity, stopLoss, takeProfit);
    if (showToast) {
        if (result.error) {
          toast({ variant: 'destructive', title: "Échec de l'achat", description: result.error });
        } else {
          toast({ title: 'Succès', description: result.success });
        }
    }
    if(!result.error){
        await fetchPortfolio();
        await market.refreshData();
    }
  }, [fetchPortfolio, market, toast]);

  const sellAsset = useCallback(async (ticker: string, quantity: number, showToast = true) => {
    const result = await sellAssetAction(ticker, quantity);
    if (showToast) {
        if (result.error) {
          toast({ variant: 'destructive', title: 'Échec de la vente', description: result.error });
        } else {
          toast({ title: 'Succès', description: result.success });
        }
    }
    if(!result.error){
        await fetchPortfolio();
        await market.refreshData();
    }
  }, [fetchPortfolio, market, toast]);

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

  const claimRewardsNow = async () => {
    const rewardsToClaim = unclaimedRewards;
    if (rewardsToClaim < 1e-9) { 
        toast({
            variant: 'destructive',
            title: 'Erreur',
            description: 'Aucune récompense significative à réclamer.'
        });
        return;
    }

    setUnclaimedRewards(0);

    const result = await claimMiningRewardsAction(rewardsToClaim);
    if (result.success) {
        toast({ title: 'Succès', description: result.success });
        await fetchPortfolio();
    } else if (result.error) {
        setUnclaimedRewards(rewardsToClaim); // Rollback on failure
        toast({ variant: 'destructive', title: "Erreur de Réclamation", description: result.error });
    }
  };

  const toggleAutoTrader = async (isEnabled: boolean) => {
    setIsAutoTraderEnabled(isEnabled); 
    const result = await toggleAutoTraderStatus(isEnabled);
    if (result.error) {
        setIsAutoTraderEnabled(!isEnabled);
        toast({ variant: 'destructive', title: 'Erreur', description: result.error });
    } else {
        toast({ title: 'Succès', description: result.success });
    }
  };

  const getHoldingQuantity = (ticker: string) => {
    const holding = portfolioData?.holdings.find(h => h.ticker === ticker);
    return holding ? holding.quantity : 0;
  };
  
  const totalHashRateMhs = portfolioData?.miningRigs.reduce((total, rig) => {
      const rigData = getRigById(rig.rigId);
      return total + (rigData?.hashRateMhs || 0) * rig.quantity;
  }, 0) || 0;

  useEffect(() => {
    if (!user || loading || totalHashRateMhs === 0) return;

    const BTC_PER_MHS_PER_SECOND = 7.7e-12;

    const miningInterval = setInterval(() => {
        const earnedThisTick = totalHashRateMhs * BTC_PER_MHS_PER_SECOND;
        setUnclaimedRewards(prev => prev + earnedThisTick);
    }, 1000);

    return () => clearInterval(miningInterval);
  }, [user, loading, totalHashRateMhs]);

  useEffect(() => {
    if (loading || market.loading || !isAutoTraderEnabled || !portfolioData) return;

    const runAiTrader = async () => {
      if (!portfolioData || market.assets.length === 0) return;

      console.log('[AutoTrader] AI is thinking...');
      
      const aiInput = {
        cash: portfolioData.cash,
        holdings: portfolioData.holdings
          .filter(h => !h.isCompanyShare) // AI only trades market assets for now
          .map(h => ({ ticker: h.ticker, name: h.name, quantity: h.quantity, avgCost: h.avgCost })),
        marketAssets: market.assets.map(a => ({ ticker: a.ticker, name: a.name, price: a.price, change24h: a.change24h })),
      };
      
      const { trades, summary } = await getAiTradingActions(aiInput);

      if (trades.length > 0) {
        toast({
            title: "🤖 Bot de Trading IA",
            description: summary,
        });

        for (const trade of trades) {
            console.log(`[AutoTrader] Executing ${trade.action}: ${trade.quantity} of ${trade.ticker}. Reason: ${trade.reason}`);
            if (trade.action === 'buy') {
                const assetPrice = market.getAssetByTicker(trade.ticker)?.price || 0;
                if (assetPrice > 0 && portfolioData.cash > (assetPrice * trade.quantity)) {
                     await buyAsset(trade.ticker, trade.quantity, undefined, undefined, false);
                }
            } else if (trade.action === 'sell') {
                const holdingQty = getHoldingQuantity(trade.ticker);
                if (trade.quantity <= holdingQty) {
                     await sellAsset(trade.ticker, trade.quantity, false);
                }
            }
        }
      } else {
        console.log('[AutoTrader] AI decided to take no action this cycle.');
      }
    };

    // Run once, then set interval
    runAiTrader();
    const autoTradeInterval = setInterval(runAiTrader, 60000); // Run every 60 seconds

    return () => clearInterval(autoTradeInterval);

  }, [isAutoTraderEnabled, portfolioData, market.assets, market.loading, loading, buyAsset, sellAsset, getHoldingQuantity, market, toast]);


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
    isAutoTraderEnabled,
    buyAsset, sellAsset, getHoldingQuantity, updateUserProfile, buyMiningRig,
    claimRewardsNow,
    toggleAutoTrader,
    refreshPortfolio: fetchPortfolio,
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
