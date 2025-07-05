'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';
import { db } from '@/lib/firebase';
import {
  doc,
  setDoc,
  collection,
  onSnapshot,
  runTransaction,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
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
  const { user } = useAuth();
  const { toast } = useToast();

  const [cash, setCash] = useState(INITIAL_CASH);
  const [initialCash, setInitialCash] = useState(INITIAL_CASH);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCash(INITIAL_CASH);
      setInitialCash(INITIAL_CASH);
      setHoldings([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCash(data.cash);
        setInitialCash(data.initialCash);
      } else {
        await setDoc(userDocRef, {
          cash: INITIAL_CASH,
          initialCash: INITIAL_CASH,
          email: user.email,
        });
        setCash(INITIAL_CASH);
        setInitialCash(INITIAL_CASH);
      }
    });

    const holdingsCollectionRef = collection(db, 'users', user.uid, 'holdings');
    const unsubscribeHoldings = onSnapshot(holdingsCollectionRef, (snapshot) => {
      const userHoldings = snapshot.docs.map(
        (doc) =>
          ({
            ticker: doc.id,
            ...doc.data(),
          } as Holding)
      );
      setHoldings(userHoldings);
    });
    
    const transactionsCollectionRef = collection(db, 'users', user.uid, 'transactions');
    const q = query(transactionsCollectionRef, orderBy('date', 'desc'));
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const userTransactions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          date: (data.date as Timestamp).toDate().toISOString().split('T')[0],
        } as Transaction;
      });
      setTransactions(userTransactions);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeHoldings();
      unsubscribeTransactions();
    };
  }, [user]);

  const buyAsset = useCallback(async (asset: Asset, quantity: number) => {
    if (!user) return;
    const cost = asset.price * quantity;

    try {
      await runTransaction(db, async (transaction) => {
        const userDocRef = doc(db, 'users', user.uid);
        const holdingDocRef = doc(db, 'users', user.uid, 'holdings', asset.ticker);

        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists() || userDoc.data().cash < cost) {
          throw new Error('Insufficient funds.');
        }

        const currentCash = userDoc.data().cash;
        transaction.update(userDocRef, { cash: currentCash - cost });

        const holdingDoc = await transaction.get(holdingDocRef);
        if (holdingDoc.exists()) {
          const currentHolding = holdingDoc.data();
          const newQuantity = currentHolding.quantity + quantity;
          const newTotalCost = (currentHolding.avgCost * currentHolding.quantity) + cost;
          const newAvgCost = newTotalCost / newQuantity;
          transaction.update(holdingDocRef, { quantity: newQuantity, avgCost: newAvgCost });
        } else {
          transaction.set(holdingDocRef, { quantity, avgCost: asset.price, name: asset.name, type: asset.type });
        }

        const newTransactionRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(newTransactionRef, {
          type: 'Buy',
          asset: { name: asset.name, ticker: asset.ticker },
          quantity,
          price: asset.price,
          value: cost,
          date: Timestamp.now(),
        });
      });
      toast({
        title: 'Purchase Successful',
        description: `You bought ${quantity} of ${asset.ticker} for $${cost.toFixed(2)}.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: e.message || 'An error occurred.',
      });
    }
  }, [user, toast]);

  const sellAsset = useCallback(async (asset: Asset, quantity: number) => {
    if (!user) return;
    const proceeds = asset.price * quantity;
    try {
      await runTransaction(db, async (transaction) => {
        const userDocRef = doc(db, 'users', user.uid);
        const holdingDocRef = doc(db, 'users', user.uid, 'holdings', asset.ticker);
        
        const userDoc = await transaction.get(userDocRef);
        const holdingDoc = await transaction.get(holdingDocRef);

        if (!userDoc.exists()) throw new Error('User not found.');
        if (!holdingDoc.exists() || holdingDoc.data().quantity < quantity) {
          throw new Error(`You are trying to sell ${quantity} of ${asset.ticker} but you only own ${holdingDoc.data()?.quantity || 0}.`);
        }

        const currentCash = userDoc.data().cash;
        transaction.update(userDocRef, { cash: currentCash + proceeds });

        const newQuantity = holdingDoc.data().quantity - quantity;
        if (newQuantity > 0) {
          transaction.update(holdingDocRef, { quantity: newQuantity });
        } else {
          transaction.delete(holdingDocRef);
        }

        const newTransactionRef = doc(collection(db, 'users', user.uid, 'transactions'));
        transaction.set(newTransactionRef, {
          type: 'Sell',
          asset: { name: asset.name, ticker: asset.ticker },
          quantity,
          price: asset.price,
          value: proceeds,
          date: Timestamp.now(),
        });
      });
      toast({
        title: 'Sale Successful',
        description: `You sold ${quantity} of ${asset.ticker} for $${proceeds.toFixed(2)}.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Sale Failed',
        description: e.message || 'An error occurred.',
      });
    }
  }, [user, toast]);

  const getHoldingQuantity = (ticker: string) => {
    return holdings.find((h) => h.ticker === ticker)?.quantity || 0;
  };
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const contextValue = {
    cash,
    holdings,
    transactions,
    buyAsset,
    sellAsset,
    getHoldingQuantity,
    initialCash,
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
