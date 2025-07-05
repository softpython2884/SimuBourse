'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
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
    const initialPricesRef = useRef<Map<string, number>>(new Map());

    const historicalData = useMemo(() => {
        const dataMap = new Map<string, HistoricalData[]>();
        initialAssets.forEach(asset => {
            dataMap.set(asset.ticker, generateHistoricalData(asset.price, 365));
        });
        return dataMap;
    }, []);

    useEffect(() => {
        initialAssets.forEach(asset => {
            if (!initialPricesRef.current.has(asset.ticker)) {
                initialPricesRef.current.set(asset.ticker, asset.price);
            }
        });

        const interval = setInterval(() => {
            setAssets(prevAssets => 
                prevAssets.map(asset => {
                    const fluctuation = (Math.random() - 0.495) * asset.price * 0.01; 
                    const newPrice = Math.max(asset.price + fluctuation, 0.01);
                    
                    const initialPrice = initialPricesRef.current.get(asset.ticker) || newPrice;
                    const change = newPrice - initialPrice;
                    const changePercent = initialPrice === 0 ? 0 : (change / initialPrice) * 100;
                    const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

                    return { ...asset, price: newPrice, change24h: newChange24h };
                })
            );
        }, 5000); // Update every 5 seconds for demonstration purposes

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
