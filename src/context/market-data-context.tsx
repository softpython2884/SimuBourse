'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { updateMarketData } from '@/lib/actions/market';
import type { DetailedAsset } from '@/lib/assets';

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
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    useEffect(() => {
        // Déclencher la mise à jour du marché au chargement de l'application
        updateMarketData();

        // Écouter les mises à jour en temps réel des prix
        const assetsUnsubscribe = onSnapshot(collection(db, 'market_state'), (snapshot) => {
            const assetsData: AssetsMap = {};
            snapshot.forEach((doc) => {
                assetsData[doc.id] = doc.data() as DetailedAsset;
            });
            setAssets(assetsData);
            setLoading(false);
        });
        
        // Écouter les données historiques
        const historicalDataUnsubscribeFunctions: (() => void)[] = [];
        const tickers = Object.keys(assets);
        
        if(tickers.length === 0){ // Au premier chargement, assets est vide, on écoute tout
            onSnapshot(collection(db, 'market_state'), (snapshot) => {
                snapshot.docs.forEach(doc => {
                    const ticker = doc.id;
                    const pointsCollectionRef = collection(db, 'historical_data', ticker, 'points');
                    const q = query(pointsCollectionRef, orderBy('date', 'desc'), limit(1440)); // 1 jour de données à la minute
                    
                    const unsubscribe = onSnapshot(q, (pointsSnapshot) => {
                        const points = pointsSnapshot.docs.map(pointDoc => {
                            const data = pointDoc.data();
                            return {
                                price: data.price,
                                date: (data.date as Timestamp).toDate().toISOString(),
                            };
                        }).reverse(); // Inverser pour que le graphique soit chronologique
                        
                        setHistoricalData(prev => ({ ...prev, [ticker]: points }));
                    });
                    historicalDataUnsubscribeFunctions.push(unsubscribe);
                });
            });
        }

        return () => {
            assetsUnsubscribe();
            historicalDataUnsubscribeFunctions.forEach(unsub => unsub());
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
