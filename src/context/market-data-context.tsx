'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { DetailedAsset, assets as initialAssetsList } from '@/lib/assets';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: DetailedAsset };
type HistoricalDataMap = { [ticker:string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

// Helper function for deterministic price simulation
const calculateDeterministicPrice = (initialPrice: number, ticker: string, timestamp: number) => {
    // A combination of sine waves to create a pseudo-random but deterministic walk
    const timeFactor1 = timestamp / 60000;  // Slow wave (1 minute cycle)
    const timeFactor2 = timestamp / 20000;  // Medium wave (20 second cycle)
    const timeFactor3 = timestamp / 5000;   // Fast wave for jitter (5 second cycle)

    const tickerFactor1 = ticker.charCodeAt(0) / 10;
    const tickerFactor2 = ticker.length;
    
    // Base trend
    const sin1 = Math.sin(timeFactor1 + tickerFactor1);
    // Medium variations
    const sin2 = Math.sin(timeFactor2 + tickerFactor2);
    // Small, quick jitter
    const sin3 = Math.sin(timeFactor3 + tickerFactor1 + tickerFactor2);

    // Combine the waves with different weights
    const noise = (sin1 * 0.02) + (sin2 * 0.015) + (sin3 * 0.005);
    
    // Force a "mean reversion" to prevent prices from drifting too far
    const reversionStrength = 0.05; 
    const drift = noise - (reversionStrength * noise);

    return initialPrice * (1 + drift);
};

const initialAssetsMap = initialAssetsList.reduce((acc, asset) => {
    acc[asset.ticker] = asset;
    return acc;
}, {} as AssetsMap);


export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>(initialAssetsMap);
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    useEffect(() => {
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        for(const ticker in initialAssetsMap) {
            const asset = initialAssetsMap[ticker];
            const data: HistoricalDataPoint[] = [];
            // Pre-fill with some historical data for the last 24h
            for (let i = 288; i > 0; i--) { // 288 points = 1 point every 5 minutes for 24h
                const timestamp = now - i * 5 * 60000;
                const price = calculateDeterministicPrice(asset.price, asset.ticker, timestamp);
                data.push({ date: new Date(timestamp).toISOString(), price });
            }
            initialHist[ticker] = data;
        }
        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    // This effect runs the client-side simulation loop.
    useEffect(() => {
        if (loading) return;

        const intervalId = setInterval(() => {
            const now = Date.now();
            
            setAssets(prevAssets => {
                const newAssets = { ...prevAssets };
                for (const ticker in newAssets) {
                    const initialAsset = initialAssetsMap[ticker];
                    if (!initialAsset) continue;
                    
                    const newPrice = calculateDeterministicPrice(initialAsset.price, ticker, now);
                    const price24hAgo = calculateDeterministicPrice(initialAsset.price, ticker, now - 86400000);
                    const changePercent = ((newPrice - price24hAgo) / price24hAgo) * 100;
                    const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

                    newAssets[ticker] = { ...newAssets[ticker], price: newPrice, change24h: newChange24h };
                }
                return newAssets;
            });

            setHistoricalData(prevHist => {
                const newHist = { ...prevHist };
                for (const ticker in newHist) {
                    if (!initialAssetsMap[ticker]) continue;

                    const newPrice = calculateDeterministicPrice(initialAssetsMap[ticker].price, ticker, now);
                    const newPoint = { date: new Date(now).toISOString(), price: newPrice };
                    const history = [...(newHist[ticker] || []), newPoint];
                    
                    // Keep history from growing too large in memory
                    newHist[ticker] = history.slice(-1500); 
                }
                return newHist;
            });
        }, 5000); // Update every 5 seconds

        return () => clearInterval(intervalId);
    }, [loading]);


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
