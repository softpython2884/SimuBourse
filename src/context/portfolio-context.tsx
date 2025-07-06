'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

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
  displayName: string;
  email: string;
  phoneNumber?: string;
  cash: number;
  initialCash: number;
}


interface PortfolioContextType {
  userProfile: UserProfile | null;
  cash: number;
  initialCash: number;
  holdings: Holding[];
  transactions: Transaction[];
  buyAsset: (asset: Asset, quantity: number) => void;
  sellAsset: (asset: Asset, quantity: number) => void;
  getHoldingQuantity: (ticker: string) => number;
  updateUserProfile: (data: Partial<Pick<UserProfile, 'displayName' | 'phoneNumber'>>) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const INITIAL_CASH = 100000;

// Ce Provider est un placeholder. Il sera reconnecté à la base de données PostgreSQL
// une fois la gestion de l'authentification et de la session mise en place.
export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();

  const showToast = () => {
     toast({
        variant: 'destructive',
        title: 'Action impossible',
        description: 'Veuillez vous connecter pour utiliser cette fonctionnalité.',
      });
  }

  const contextValue = {
    userProfile: null,
    cash: INITIAL_CASH,
    initialCash: INITIAL_CASH,
    holdings: [],
    transactions: [],
    buyAsset: () => showToast(),
    sellAsset: () => showToast(),
    getHoldingQuantity: () => 0,
    updateUserProfile: async () => showToast(),
  };

  return (
    <PortfolioContext.Provider value={contextValue}>
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
