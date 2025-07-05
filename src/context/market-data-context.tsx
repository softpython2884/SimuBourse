'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { updateMarketData } from '@/lib/actions/market';
import type { DetailedAsset } from '@/lib/assets';
import { useAuth } from './auth-context';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: DetailedAsset };
type HistoricalDataMap = { [ticker: string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    // Cet effet se déclenche uniquement lorsque le statut de l'utilisateur change.
    // Il déclenche la mise à jour du marché côté serveur.
    useEffect(() => {
        if (user) {
            updateMarketData();
        }
    }, [user]);

    // Cet effet met en place tous les auditeurs de données en temps réel.
    useEffect(() => {
        const unsubscribeFunctions: (() => void)[] = [];

        // Auditeur pour les prix des actifs en temps réel
        const assetsUnsubscribe = onSnapshot(collection(db, 'market_state'), (snapshot) => {
            const newAssetsData: AssetsMap = {};
            const receivedTickers: string[] = [];
            snapshot.forEach((doc) => {
                newAssetsData[doc.id] = doc.data() as DetailedAsset;
                receivedTickers.push(doc.id);
            });
            setAssets(newAssetsData);
            setLoading(false);
        }, (error) => {
            console.error("Erreur de l'auditeur Firebase market_state :", error);
            setLoading(false); // Arrêter le chargement en cas d'erreur
        });
        
        unsubscribeFunctions.push(assetsUnsubscribe);

        // Auditeur pour les données historiques, déclenché une seule fois
        const historicalUnsubscribe = onSnapshot(collection(db, 'market_state'), (snapshot) => {
            snapshot.docs.forEach(doc => {
                const ticker = doc.id;
                const pointsCollectionRef = collection(db, 'historical_data', ticker, 'points');
                const q = query(pointsCollectionRef, orderBy('date', 'desc'), limit(1440));
                
                const unsubscribe = onSnapshot(q, (pointsSnapshot) => {
                    const points = pointsSnapshot.docs.map(pointDoc => {
                        const data = pointDoc.data();
                        return {
                            price: data.price,
                            date: (data.date as Timestamp).toDate().toISOString(),
                        };
                    }).reverse();
                    
                    setHistoricalData(prev => ({ ...prev, [ticker]: points }));
                });
                unsubscribeFunctions.push(unsubscribe);
            });
        });
        unsubscribeFunctions.push(historicalUnsubscribe);


        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
        };
    }, []);

    const getAssetByTicker = useCallback((ticker: string): DetailedAsset | undefined => {
        return assets[ticker];
    }, [assets]);

    const getHistoricalData = useCallback((ticker: string): HistoricalDataPoint[] => {
        return historicalData[ticker] || [];
    }, [historicalData]);

    const assetsArray = React.useMemo(() => Object.values(assets), [assets]);

    const value = {
        assets: assetsArray,
        getAssetByTicker,
        getHistoricalData,
        loading,
    };
    
    return (
        <MarketDataContext.Provider value={value}>
            {loading ? (
                <div className="flex h-screen w-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                children
            )}
        </MarketDataContext.Provider>
    );
};

export const useMarketData = () => {
    const context = useContext(MarketDataContext);
    if (context === undefined) {
        throw new Error('useMarketData must be used within a MarketDataProvider');
    }
    return context;
};
