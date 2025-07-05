'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { assets as initialAssets, generateHistoricalData, DetailedAsset } from '@/lib/assets';
import type { Asset } from './portfolio-context';
import { Loader2 } from 'lucide-react';

export type HistoricalData = {
    date: string;
    price: number;
};

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalData[];
    loading: boolean;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<DetailedAsset[]>(initialAssets);

    const historicalData = useMemo(() => {
        const dataMap = new Map<string, HistoricalData[]>();
        initialAssets.forEach(asset => {
            dataMap.set(asset.ticker, generateHistoricalData(asset.price, 365));
        });
        return dataMap;
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setAssets(prevAssets => 
                prevAssets.map(asset => {
                    const fluctuation = (Math.random() - 0.49) * asset.price * 0.005; // Smaller fluctuation for real-time
                    const newPrice = Math.max(asset.price + fluctuation, 0.01);
                    return { ...asset, price: newPrice };
                })
            );
        }, 5000); // Update every 5 seconds

        setLoading(false);

        return () => clearInterval(interval);
    }, []);

    const getAssetByTicker = (ticker: string) => {
        return assets.find(a => a.ticker === ticker);
    };

    const getHistoricalData = (ticker: string) => {
        return historicalData.get(ticker) || [];
    }
    
    if (loading) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    return (
        <MarketDataContext.Provider value={{ assets, getAssetByTicker, getHistoricalData, loading }}>
            {children}
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
