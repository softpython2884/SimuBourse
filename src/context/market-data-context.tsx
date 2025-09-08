'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getAssets, AssetFromDb, updateAllAssetPrices } from '@/lib/actions/assets';
import { subDays } from 'date-fns';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: AssetFromDb };
type HistoricalDataMap = { [ticker:string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: AssetFromDb[];
    getAssetByTicker: (ticker: string) => AssetFromDb | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    const fetchData = useCallback(async () => {
        const assetsData = await getAssets();
        
        const assetsMap = assetsData.reduce((acc, asset) => {
            acc[asset.ticker] = asset;
            return acc;
        }, {} as AssetsMap);

        setAssets(assetsMap);
        
        setHistoricalData(currentHistData => {
            const newHistData = { ...currentHistData };
            const now = new Date().toISOString();

            for (const ticker in assetsMap) {
                const newPoint = { date: now, price: assetsMap[ticker].price };
                if (!newHistData[ticker] || newHistData[ticker].length === 0) {
                     // Generate some fake historical data on first load
                    const initialData: HistoricalDataPoint[] = [];
                    for(let i=48; i>0; i--) {
                        const pastDate = subDays(new Date(), i/48);
                        const priceFluctuation = assetsMap[ticker].price * (1 + (Math.random() - 0.5) * 0.1);
                        initialData.push({ date: pastDate.toISOString(), price: priceFluctuation });
                    }
                    initialData.push(newPoint);
                    newHistData[ticker] = initialData;
                } else {
                    const updatedHistory = [...newHistData[ticker], newPoint].slice(-100);
                    newHistData[ticker] = updatedHistory;
                }
            }
            return newHistData;
        });

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        const priceUpdateInterval = setInterval(async () => {
            await updateAllAssetPrices();
            await fetchData();
        }, 5000); // Update prices every 5 seconds

        return () => clearInterval(priceUpdateInterval);
    }, [fetchData]);

    const getAssetByTicker = useCallback((ticker: string): AssetFromDb | undefined => {
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
        refreshData: fetchData,
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
