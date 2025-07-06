'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { DetailedAsset, assets as initialAssetsList } from '@/lib/assets';
import type { GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: DetailedAsset };
type HistoricalDataMap = { [ticker:string]: HistoricalDataPoint[] };

interface NewsEvent {
    sentiment: 'positive' | 'negative' | 'neutral';
    timestamp: number;
}

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
    registerNewsEvent: (ticker: string, sentiment: 'positive' | 'negative' | 'neutral') => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const calculateNextPrice = (
    previousPrice: number, 
    ticker: string, 
    timestamp: number, 
    initialPrice: number,
    event?: NewsEvent
) => {
    // If a news event just occurred, apply a one-time price shock.
    if (event) {
        let shock = 0;
        // Positive news causes a 2% to 6% jump
        if (event.sentiment === 'positive') shock = (Math.random() * 0.04) + 0.02; 
        // Negative news causes a 2% to 6% drop
        if (event.sentiment === 'negative') shock = -((Math.random() * 0.04) + 0.02);
        
        const shockedPrice = previousPrice * (1 + shock);
        return shockedPrice > 0 ? shockedPrice : 0.01;
    }

    // Otherwise, perform the normal random walk simulation.
    const seed = timestamp + ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomValue = seededRandom(seed);

    const drift = 0.000001;
    const volatility = 0.015; // Significantly increased for more noticeable swings
    const meanReversionFactor = 0.00005; // Weakened to allow more price drift

    const changePercent = drift + volatility * (randomValue - 0.5) * 2;
    let newPrice = previousPrice * (1 + changePercent);
    newPrice = newPrice * (1 - meanReversionFactor) + initialPrice * meanReversionFactor;

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
    const [newsEvents, setNewsEvents] = useState<{ [ticker: string]: NewsEvent }>({});

    const assetsRef = useRef(assets);
    assetsRef.current = assets;
    const historicalDataRef = useRef(historicalData);
    historicalDataRef.current = historicalData;
    const newsEventsRef = useRef(newsEvents);
    newsEventsRef.current = newsEvents;

    const registerNewsEvent = useCallback((ticker: string, sentiment: 'positive' | 'negative' | 'neutral') => {
        if (sentiment === 'neutral') return;
        setNewsEvents(prev => ({
            ...prev,
            [ticker]: { sentiment, timestamp: Date.now() },
        }));
    }, []);

    useEffect(() => {
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        const newAssetsMap: AssetsMap = { ...initialAssetsMap };

        for(const ticker in initialAssetsMap) {
            const asset = initialAssetsMap[ticker];
            const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
            let currentPrice = asset.price * (1 + (seededRandom(ticker.charCodeAt(0)) - 0.5) * 0.4); 
            
            const totalHours = 365 * 24;
            const data: HistoricalDataPoint[] = [];
            for (let i = 0; i < totalHours; i++) {
                const timestamp = oneYearAgo + i * 60 * 60 * 1000;
                currentPrice = calculateNextPrice(currentPrice, asset.ticker, timestamp, asset.price);
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
            const currentNewsEvents = newsEventsRef.current;
            
            const newAssetsMap: AssetsMap = { ...currentAssets };
            const newHistoricalDataMap: HistoricalDataMap = { ...currentHistoricalData };
            const updatedNewsEvents: { [ticker: string]: NewsEvent } = { ...currentNewsEvents };
            let anEventOccurred = false;

            for (const ticker in newAssetsMap) {
                const currentAsset = newAssetsMap[ticker];
                const initialAsset = initialAssetsMap[ticker];
                if (!currentAsset || !initialAsset) continue;

                const eventForTicker = updatedNewsEvents[ticker];
                const newPrice = calculateNextPrice(currentAsset.price, ticker, now, initialAsset.price, eventForTicker);

                if (eventForTicker) {
                    delete updatedNewsEvents[ticker];
                    anEventOccurred = true;
                }
                
                const newPoint = { date: new Date(now).toISOString(), price: newPrice };
                const updatedHistory = [...(newHistoricalDataMap[ticker] || []), newPoint];
                if (updatedHistory.length > 8760 + 17280) { 
                    updatedHistory.shift();
                }
                newHistoricalDataMap[ticker] = updatedHistory;
                
                const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
                const closestPoint = updatedHistory.reduce((prev, curr) => {
                    const currTime = new Date(curr.date).getTime();
                    const prevTime = new Date(prev.date).getTime();
                    return Math.abs(currTime - twentyFourHoursAgo) < Math.abs(prevTime - twentyFourHoursAgo) ? curr : prev;
                }, updatedHistory[0]);
                
                const price24hAgo = closestPoint.price;
                const changePercent = price24hAgo > 0 ? ((newPrice - price24hAgo) / price24hAgo) * 100 : 0;
                const change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                
                newAssetsMap[ticker] = { ...currentAsset, price: newPrice, change24h };
            }

            if (anEventOccurred) {
                setNewsEvents(updatedNewsEvents);
            }
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
