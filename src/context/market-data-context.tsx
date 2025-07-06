'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

// A pseudo-random number generator that can be seeded for deterministic results
const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// More realistic price simulation using a random walk model
const calculateNextPrice = (previousPrice: number, ticker: string, timestamp: number, initialPrice: number) => {
    const seed = timestamp + ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomValue = seededRandom(seed);

    // Parameters for a simplified Geometric Brownian Motion
    const drift = 0.0000001; // A very slight upward trend over time
    const volatility = 0.003; // Increased volatility for more noticeable price swings

    // Calculate the percentage change. (randomValue - 0.5) * 2 creates a value between -1 and 1
    const changePercent = drift + volatility * (randomValue - 0.5) * 2;

    let newPrice = previousPrice * (1 + changePercent);

    // Add a mean-reversion component to pull the price back towards its initial value over the long term
    // This prevents prices from drifting into absurd values in our simulation.
    const meanReversionFactor = 0.0001; 
    newPrice = newPrice * (1 - meanReversionFactor) + initialPrice * meanReversionFactor;

    return newPrice > 0 ? newPrice : 0.01; // Ensure price is not negative
};

const initialAssetsMap = initialAssetsList.reduce((acc, asset) => {
    acc[asset.ticker] = asset;
    return acc;
}, {} as AssetsMap);


export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>(initialAssetsMap);
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    const assetsRef = useRef(assets);
    assetsRef.current = assets;
    const historicalDataRef = useRef(historicalData);
    historicalDataRef.current = historicalData;

    useEffect(() => {
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        const newAssetsMap: AssetsMap = { ...initialAssetsMap };

        // Generate more realistic historical data
        for(const ticker in initialAssetsMap) {
            const asset = initialAssetsMap[ticker];
            
            // Generate hourly data for the past year sequentially
            const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
            // Start the random walk from a point +/- 20% of the initial price one year ago
            let currentPrice = asset.price * (1 + (seededRandom(ticker.charCodeAt(0)) - 0.5) * 0.4); 
            
            const totalHours = 365 * 24;
            const data: HistoricalDataPoint[] = [];
            for (let i = 0; i < totalHours; i++) {
                const timestamp = oneYearAgo + i * 60 * 60 * 1000;
                currentPrice = calculateNextPrice(currentPrice, asset.ticker, timestamp, asset.price);
                data.push({ date: new Date(timestamp).toISOString(), price: currentPrice });
            }
            
            initialHist[ticker] = data;

            // Update the asset's current price to the last generated price
            const lastPrice = data[data.length - 1]?.price || asset.price;
            const price24hAgo = data[data.length - 25]?.price || lastPrice; // 24 hours + 1 buffer point
            const changePercent = ((lastPrice - price24hAgo) / price24hAgo) * 100;
            const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            newAssetsMap[ticker] = { ...asset, price: lastPrice, change24h };
        }

        setAssets(newAssetsMap);
        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    // This effect runs the client-side simulation loop.
    useEffect(() => {
        if (loading) return;

        const intervalId = setInterval(() => {
            const now = Date.now();
            const currentAssets = assetsRef.current;
            const currentHistoricalData = historicalDataRef.current;
            
            const newAssetsMap: AssetsMap = { ...currentAssets };
            const newHistoricalDataMap: HistoricalDataMap = { ...currentHistoricalData };

            for (const ticker in newAssetsMap) {
                const currentAsset = newAssetsMap[ticker];
                const initialAsset = initialAssetsMap[ticker];
                if (!currentAsset || !initialAsset) continue;

                // 1. Calculate new price
                const newPrice = calculateNextPrice(currentAsset.price, ticker, now, initialAsset.price);

                // 2. Update history
                const newPoint = { date: new Date(now).toISOString(), price: newPrice };
                const updatedHistory = [...(newHistoricalDataMap[ticker] || []), newPoint];
                 // Keep ~1 year of hourly data + ~1 day of 5-second ticks
                if (updatedHistory.length > 8760 + 17280) { 
                    updatedHistory.shift();
                }
                newHistoricalDataMap[ticker] = updatedHistory;
                
                // 3. Find price from 24h ago to calculate change
                const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                // Find the point in history closest to 24 hours ago
                const closestPoint = updatedHistory.reduce((prev, curr) => {
                    const currTime = new Date(curr.date).getTime();
                    const prevTime = new Date(prev.date).getTime();
                    return Math.abs(currTime - twentyFourHoursAgo) < Math.abs(prevTime - twentyFourHoursAgo) ? curr : prev;
                }, updatedHistory[0]);
                
                const price24hAgo = closestPoint.price;
                const changePercent = price24hAgo > 0 ? ((newPrice - price24hAgo) / price24hAgo) * 100 : 0;
                const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                
                // 4. Update asset with new price and change
                newAssetsMap[ticker] = { ...currentAsset, price: newPrice, change24h };
            }

            setAssets(newAssetsMap);
            setHistoricalData(newHistoricalDataMap);

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
