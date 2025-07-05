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
  updateDoc,
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

export const PortfolioProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const cash = userProfile?.cash ?? INITIAL_CASH;
  const initialCash = userProfile?.initialCash ?? INITIAL_CASH;


  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setHoldings([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        const newUserProfile: UserProfile = {
          displayName: user.displayName || user.email?.split('@')[0] || 'Joueur',
          email: user.email!,
          cash: INITIAL_CASH,
          initialCash: INITIAL_CASH,
          phoneNumber: '',
        };
        await setDoc(userDocRef, newUserProfile);
        setUserProfile(newUserProfile);
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

  const updateUserProfile = useCallback(async (data: Partial<Pick<UserProfile, 'displayName' | 'phoneNumber'>>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
        await updateDoc(userDocRef, data);
        toast({
            title: 'Profil mis à jour',
            description: 'Vos informations ont été enregistrées avec succès.',
        });
    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Échec de la mise à jour',
            description: e.message || 'An error occurred.',
        });
    }
  }, [user, toast]);

  const buyAsset = useCallback(async (asset: Asset, quantity: number) => {
    if (!user) return;
    const cost = asset.price * quantity;

    console.log(`[BUY_TRANSACTION] Initiating for ${quantity} of ${asset.ticker}`);
    try {
      await runTransaction(db, async (t) => {
        console.log('[BUY_TRANSACTION] Inside transaction callback.');

        // --- PHASE 1: READS ---
        console.log('[BUY_TRANSACTION] Phase 1: Reading documents.');
        const userDocRef = doc(db, 'users', user.uid);
        const holdingDocRef = doc(db, 'users', user.uid, 'holdings', asset.ticker);
        
        const userDoc = await t.get(userDocRef);
        const holdingDoc = await t.get(holdingDocRef);
        console.log(`[BUY_TRANSACTION] Phase 1 Complete. User exists: ${userDoc.exists()}, Holding exists: ${holdingDoc.exists()}.`);

        // --- PHASE 2: VALIDATION & PREPARATION (NO DB INTERACTIONS) ---
        console.log('[BUY_TRANSACTION] Phase 2: Validating and preparing data.');
        if (!userDoc.exists()) {
          throw new Error('Utilisateur non trouvé.');
        }
        
        const currentCash = userDoc.data().cash;
        if (currentCash < cost) {
          throw new Error('Fonds insuffisants.');
        }

        const newCashValue = currentCash - cost;
        let newHoldingData;

        if (holdingDoc.exists()) {
          const currentHolding = holdingDoc.data();
          const newQuantity = currentHolding.quantity + quantity;
          const newTotalCost = (currentHolding.avgCost * currentHolding.quantity) + cost;
          const newAvgCost = newTotalCost / newQuantity;
          newHoldingData = { ...currentHolding, quantity: newQuantity, avgCost: newAvgCost };
        } else {
          newHoldingData = { 
            quantity, 
            avgCost: asset.price, 
            name: asset.name, 
            type: asset.type 
          };
        }

        const newTransactionPayload = {
          type: 'Buy' as const,
          asset: { name: asset.name, ticker: asset.ticker },
          quantity,
          price: asset.price,
          value: cost,
          date: Timestamp.now(),
        };
        const newTransactionRef = doc(collection(db, 'users', user.uid, 'transactions'));
        console.log('[BUY_TRANSACTION] Phase 2 Complete. Data prepared.');


        // --- PHASE 3: WRITES ---
        console.log('[BUY_TRANSACTION] Phase 3: Writing documents.');
        t.update(userDocRef, { cash: newCashValue });
        console.log('[BUY_TRANSACTION] Queued user cash update.');
        t.set(holdingDocRef, newHoldingData);
        console.log('[BUY_TRANSACTION] Queued holding update/set.');
        t.set(newTransactionRef, newTransactionPayload);
        console.log('[BUY_TRANSACTION] Queued new transaction log.');
        console.log('[BUY_TRANSACTION] Phase 3 Complete. All writes queued.');
      });

      toast({
        title: 'Achat réussi',
        description: `Vous avez acheté ${quantity} ${asset.ticker} pour $${cost.toFixed(2)}.`,
      });
    } catch (e: any) {
      console.error('[BUY_TRANSACTION_FAILED] Error during transaction:', e);
      toast({
        variant: 'destructive',
        title: 'Échec de l\'achat',
        description: e.message || 'Une erreur est survenue.',
      });
    }
  }, [user, toast]);

  const sellAsset = useCallback(async (asset: Asset, quantity: number) => {
    if (!user) return;
    const proceeds = asset.price * quantity;

    console.log(`[SELL_TRANSACTION] Initiating for ${quantity} of ${asset.ticker}`);
    try {
      await runTransaction(db, async (t) => {
        console.log('[SELL_TRANSACTION] Inside transaction callback.');

        // --- PHASE 1: READS ---
        console.log('[SELL_TRANSACTION] Phase 1: Reading documents.');
        const userDocRef = doc(db, 'users', user.uid);
        const holdingDocRef = doc(db, 'users', user.uid, 'holdings', asset.ticker);
        
        const userDoc = await t.get(userDocRef);
        const holdingDoc = await t.get(holdingDocRef);
        console.log(`[SELL_TRANSACTION] Phase 1 Complete. User exists: ${userDoc.exists()}, Holding exists: ${holdingDoc.exists()}.`);

        // --- PHASE 2: VALIDATION & PREPARATION (NO DB INTERACTIONS) ---
        console.log('[SELL_TRANSACTION] Phase 2: Validating and preparing data.');
        if (!userDoc.exists()) {
          throw new Error('Utilisateur non trouvé.');
        }
        if (!holdingDoc.exists()) {
          throw new Error(`Vous n'avez pas d'actions ${asset.ticker} à vendre.`);
        }
        
        const currentHolding = holdingDoc.data();
        if (currentHolding.quantity < quantity) {
          throw new Error(`Vous essayez de vendre ${quantity} ${asset.ticker} mais vous en possédez seulement ${currentHolding.quantity}.`);
        }

        const newCashValue = userDoc.data().cash + proceeds;
        const newQuantity = currentHolding.quantity - quantity;
        
        const newTransactionPayload = {
          type: 'Sell' as const,
          asset: { name: asset.name, ticker: asset.ticker },
          quantity,
          price: asset.price,
          value: proceeds,
          date: Timestamp.now(),
        };
        const newTransactionRef = doc(collection(db, 'users', user.uid, 'transactions'));
        console.log('[SELL_TRANSACTION] Phase 2 Complete. Data prepared.');
        
        // --- PHASE 3: WRITES ---
        console.log('[SELL_TRANSACTION] Phase 3: Writing documents.');
        t.update(userDocRef, { cash: newCashValue });
        console.log('[SELL_TRANSACTION] Queued user cash update.');

        if (newQuantity > 0.00001) {
          t.update(holdingDocRef, { quantity: newQuantity });
          console.log('[SELL_TRANSACTION] Queued holding quantity update.');
        } else {
          t.delete(holdingDocRef);
          console.log('[SELL_TRANSACTION] Queued holding deletion.');
        }

        t.set(newTransactionRef, newTransactionPayload);
        console.log('[SELL_TRANSACTION] Queued new transaction log.');
        console.log('[SELL_TRANSACTION] Phase 3 Complete. All writes queued.');
      });

      toast({
        title: 'Vente réussie',
        description: `Vous avez vendu ${quantity} ${asset.ticker} pour $${proceeds.toFixed(2)}.`,
      });
    } catch (e: any) {
      console.error('[SELL_TRANSACTION_FAILED] Error during transaction:', e);
      toast({
        variant: 'destructive',
        title: 'Échec de la vente',
        description: e.message || 'Une erreur est survenue.',
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
    userProfile,
    cash,
    initialCash,
    holdings,
    transactions,
    buyAsset,
    sellAsset,
    getHoldingQuantity,
    updateUserProfile,
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
