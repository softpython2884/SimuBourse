
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

interface MomentumData {
    momentum: number; // The initial momentum value from the news
    timestamp: number; // The time the news event occurred
}

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
    registerNewsEvent: (ticker: string, impactScore: number) => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

// A mulberry32 pseudo-random number generator.
const seededRandom = (seed: number) => {
    let t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const calculateNextPrice = (
    previousPrice: number, 
    ticker: string, 
    timestamp: number, 
    momentum: number
) => {
    const seed = timestamp + ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomValue = seededRandom(seed);
    
    // Low base volatility for background noise, making the chart less flat.
    const volatility = 0.0001;
    
    // A tiny positive drift to simulate a generally healthy market over the long term.
    const baseDrift = 0.00000002;
    
    // The total change is the sum of the long-term drift, the current news-driven momentum, and the random noise.
    const changePercent = baseDrift + momentum + volatility * (randomValue - 0.5) * 2;
    const newPrice = previousPrice * (1 + changePercent);
    
    return newPrice > 0 ? newPrice : 0.01;
};

const initialAssetsMap = initialAssetsList.reduce((acc, asset) => {
    acc[asset.ticker] = asset;
    return acc;
}, {} as AssetsMap);


export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>(initialAssetsMap);
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});
    const [marketMomentum, setMarketMomentum] = useState<{ [ticker: string]: MomentumData }>({});

    const assetsRef = useRef(assets);
    assetsRef.current = assets;
    const historicalDataRef = useRef(historicalData);
    historicalDataRef.current = historicalData;
    const marketMomentumRef = useRef(marketMomentum);
    marketMomentumRef.current = marketMomentum;

    const registerNewsEvent = useCallback((ticker: string, impactScore: number) => {
        // A max score of 10 creates a significant trend. We map it to a momentum value.
        // This value is the primary driver of price change for the next few hours.
        const initialMomentum = impactScore * 0.00005; 

        setMarketMomentum(prev => ({
            ...prev,
            [ticker]: { momentum: initialMomentum, timestamp: Date.now() },
        }));
    }, []);

    useEffect(() => {
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        const newAssetsMap: AssetsMap = { ...initialAssetsMap };

        for(const ticker in initialAssetsMap) {
            const asset = initialAssetsMap[ticker];
            const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
            let currentPrice = asset.price;
            
            const totalHours = 365 * 24;
            const data: HistoricalDataPoint[] = [];
            for (let i = 0; i < totalHours; i++) {
                const timestamp = oneYearAgo + i * 60 * 60 * 1000;
                // Generate initial history with only the base drift and jitter (momentum is 0)
                currentPrice = calculateNextPrice(currentPrice, asset.ticker, timestamp, 0);
                data.push({ date: new Date(timestamp).toISOString(), price: currentPrice });
            }
            
            initialHist[ticker] = data;

            const lastPrice = data[data.length - 1]?.price || asset.price;
            const price24hAgo = data[data.length - 25]?.price || lastPrice;
            const changePercent = ((lastPrice - price24hAgo) / price24hAgo) * 100;
            const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
            newAssetsMap[ticker] = { ...asset, price: lastPrice, change24h };
        }

        setAssets(newAssetsMap);
        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (loading) return;

        const intervalId = setInterval(() => {
            const now = Date.now();
            const currentAssets = assetsRef.current;
            const currentHistoricalData = historicalDataRef.current;
            const currentMarketMomentum = marketMomentumRef.current;
            
            const newAssetsMap: AssetsMap = { ...currentAssets };
            const newHistoricalDataMap: HistoricalDataMap = { ...currentHistoricalData };
            const newMarketMomentum = { ...currentMarketMomentum };

            for (const ticker in newAssetsMap) {
                const currentAsset = newAssetsMap[ticker];
                if (!currentAsset) continue;
                
                let activeMomentum = 0;
                const momentumData = newMarketMomentum[ticker];

                if (momentumData) {
                    const timeSinceEvent = now - momentumData.timestamp;
                    const DECAY_HOURS = 4; // The news effect will fade over 4 hours
                    const DECAY_CONSTANT = DECAY_HOURS * 60 * 60 * 1000;
                    
                    // Exponential decay of the momentum
                    const decayFactor = Math.exp(-timeSinceEvent / DECAY_CONSTANT);
                    activeMomentum = momentumData.momentum * decayFactor;

                    // If momentum is negligible, remove it to stop calculations
                    if (Math.abs(activeMomentum) < 1e-9) {
                        delete newMarketMomentum[ticker];
                    }
                }

                const newPrice = calculateNextPrice(currentAsset.price, ticker, now, activeMomentum);
                
                const newPoint = { date: new Date(now).toISOString(), price: newPrice };
                const updatedHistory = [...(newHistoricalDataMap[ticker] || []), newPoint];
                if (updatedHistory.length > 8760 * 2) { // Keep a bit more than a year of hourly data
                    updatedHistory.shift();
                }
                newHistoricalDataMap[ticker] = updatedHistory;
                
                const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                const closestPoint = updatedHistory.reduce((prev, curr) => {
                    const currTime = new Date(curr.date).getTime();
                    const prevTime = new Date(prev.date).getTime();
                    return Math.abs(currTime - twentyFourHoursAgo) < Math.abs(prevTime - twentyFourHoursAgo) ? curr : prev;
                }, updatedHistory[0] || newPoint);
                
                const price24hAgo = closestPoint.price;
                const changePercent = price24hAgo > 0 ? ((newPrice - price24hAgo) / price24hAgo) * 100 : 0;
                const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                
                newAssetsMap[ticker] = { ...currentAsset, price: newPrice, change24h };
            }
            
            setMarketMomentum(newMarketMomentum);
            setAssets(newAssetsMap);
            setHistoricalData(newHistoricalDataMap);

        }, 5000);

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
        registerNewsEvent,
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
