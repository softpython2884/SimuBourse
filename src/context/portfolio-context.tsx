'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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
}

export interface Transaction {
  type: 'Buy' | 'Sell';
  asset: { name: string, ticker: string };
  quantity: number;
  price: number;
  value: number;
  date: string;
}

interface PortfolioContextType {
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
  buyAsset: (asset: Asset, quantity: number) => void;
  sellAsset: (asset: Asset, quantity: number) => void;
  getHoldingQuantity: (ticker: string) => number;
  initialCash: number;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const INITIAL_CASH = 100000;

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [cash, setCash] = useState(INITIAL_CASH);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { toast } = useToast();

  const buyAsset = useCallback((asset: Asset, quantity: number) => {
    const cost = asset.price * quantity;
    if (cost > cash) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Funds',
        description: `You need $${cost.toFixed(2)} but only have $${cash.toFixed(2)}.`,
      });
      return;
    }

    setCash(prevCash => prevCash - cost);

    setHoldings(prevHoldings => {
      const existingHoldingIndex = prevHoldings.findIndex(h => h.ticker === asset.ticker);
      if (existingHoldingIndex > -1) {
        const existingHolding = prevHoldings[existingHoldingIndex];
        const newQuantity = existingHolding.quantity + quantity;
        const newTotalCost = (existingHolding.avgCost * existingHolding.quantity) + cost;
        const newAvgCost = newTotalCost / newQuantity;
        
        const updatedHoldings = [...prevHoldings];
        updatedHoldings[existingHoldingIndex] = { ...existingHolding, quantity: newQuantity, avgCost: newAvgCost };
        return updatedHoldings;
      } else {
        return [...prevHoldings, { ticker: asset.ticker, quantity, avgCost: asset.price }];
      }
    });

    const newTransaction: Transaction = {
      type: 'Buy',
      asset: { name: asset.name, ticker: asset.ticker },
      quantity,
      price: asset.price,
      value: cost,
      date: new Date().toISOString().split('T')[0],
    };
    setTransactions(prev => [newTransaction, ...prev]);

    toast({
      title: 'Purchase Successful',
      description: `You bought ${quantity} of ${asset.ticker} for $${cost.toFixed(2)}.`,
    });
  }, [cash, toast]);

  const sellAsset = useCallback((asset: Asset, quantity: number) => {
    const existingHolding = holdings.find(h => h.ticker === asset.ticker);
    if (!existingHolding || existingHolding.quantity < quantity) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Holdings',
        description: `You are trying to sell ${quantity} of ${asset.ticker} but you only own ${existingHolding?.quantity || 0}.`,
      });
      return;
    }

    const proceeds = asset.price * quantity;
    setCash(prevCash => prevCash + proceeds);

    setHoldings(prevHoldings => {
      const holdingIndex = prevHoldings.findIndex(h => h.ticker === asset.ticker);
      const holding = prevHoldings[holdingIndex];
      const newQuantity = holding.quantity - quantity;

      if (newQuantity === 0) {
        return prevHoldings.filter(h => h.ticker !== asset.ticker);
      } else {
        const updatedHoldings = [...prevHoldings];
        updatedHoldings[holdingIndex] = { ...holding, quantity: newQuantity };
        return updatedHoldings;
      }
    });

    const newTransaction: Transaction = {
      type: 'Sell',
      asset: { name: asset.name, ticker: asset.ticker },
      quantity,
      price: asset.price,
      value: proceeds,
      date: new Date().toISOString().split('T')[0],
    };
    setTransactions(prev => [newTransaction, ...prev]);

    toast({
      title: 'Sale Successful',
      description: `You sold ${quantity} of ${asset.ticker} for $${proceeds.toFixed(2)}.`,
    });
  }, [holdings, toast]);
  
  const getHoldingQuantity = (ticker: string) => {
    return holdings.find(h => h.ticker === ticker)?.quantity || 0;
  };

  const contextValue = {
    cash,
    holdings,
    transactions,
    buyAsset,
    sellAsset,
    getHoldingQuantity,
    initialCash: INITIAL_CASH,
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
