'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getAssets, AssetFromDb } from '@/lib/actions/assets';
import { parseISO, subDays } from 'date-fns';

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

    const initializeMarket = useCallback(async () => {
        setLoading(true);
        const assetsData = await getAssets();
        
        const assetsMap = assetsData.reduce((acc, asset) => {
            acc[asset.ticker] = asset;
            return acc;
        }, {} as AssetsMap);
        setAssets(assetsMap);

        // Generate a flat historical baseline for all assets for charting
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        for (const ticker in assetsMap) {
            const asset = assetsMap[ticker];
            const oneDayAgo = subDays(now, 1);
            let currentPrice = asset.price;
            const data: HistoricalDataPoint[] = [];
             // Generate 24 hours of data points (one per hour)
            for (let i = 0; i < 24 * 2; i++) { // 48 points for smoother chart
                const timestamp = oneDayAgo + i * 30 * 60 * 1000; // 30 min intervals
                data.push({ date: new Date(timestamp).toISOString(), price: currentPrice });
            }
             data.push({ date: new Date(now).toISOString(), price: currentPrice });
            initialHist[ticker] = data;
        }

        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    useEffect(() => {
        initializeMarket();
    }, [initializeMarket]);

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
        refreshData: initializeMarket,
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
