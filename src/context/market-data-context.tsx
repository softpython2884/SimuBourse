
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { DetailedAsset, assets as initialAssetsList } from '@/lib/assets';
import type { GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';
import { getOrGenerateAssetNews } from '@/lib/actions/news';


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
    getNewsForTicker: (ticker: string) => GenerateAssetNewsOutput | undefined;
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
    targetPrice: number,
    ticker: string,
    timestamp: number
) => {
    const seed = timestamp + ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomValue = seededRandom(seed);

    // Determines how fast the price moves towards its target.
    const REVERSION_SPEED = 0.03;
    // Determines the random "jitter" or noise around the price trend.
    const VOLATILITY = 0.015;

    // The force pulling the price towards its target
    const reversionForce = (targetPrice - previousPrice) * REVERSION_SPEED;
    // The random market noise
    const randomWalk = previousPrice * VOLATILITY * (randomValue - 0.5);

    const newPrice = previousPrice + reversionForce + randomWalk;

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
    const [news, setNews] = useState<{ [ticker: string]: GenerateAssetNewsOutput }>({});
    const [targetPrices, setTargetPrices] = useState<{ [ticker: string]: number }>({});

    const assetsRef = useRef(assets);
    assetsRef.current = assets;
    const historicalDataRef = useRef(historicalData);
    historicalDataRef.current = historicalData;
    const targetPricesRef = useRef(targetPrices);
    targetPricesRef.current = targetPrices;

    useEffect(() => {
        const initializeMarket = async () => {
            const now = Date.now();
            const initialHist: HistoricalDataMap = {};
            const initialAssetsWithPrices: AssetsMap = { ...initialAssetsMap };

            // 1. Generate a flat historical baseline for all assets
            for (const ticker in initialAssetsMap) {
                const asset = initialAssetsMap[ticker];
                const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
                let currentPrice = asset.price;
                const data: HistoricalDataPoint[] = [];
                for (let i = 0; i < 365 * 24; i++) {
                    const timestamp = oneYearAgo + i * 60 * 60 * 1000;
                    data.push({ date: new Date(timestamp).toISOString(), price: currentPrice });
                }
                
                initialHist[ticker] = data;
                initialAssetsWithPrices[ticker] = { ...asset, price: currentPrice, change24h: '+0.00%' };
            }

            setHistoricalData(initialHist);
            setAssets(initialAssetsWithPrices);
            
            // 2. Fetch or generate news for ALL assets at once
            const newsPromises = initialAssetsList.map(asset => 
                getOrGenerateAssetNews(asset.ticker, asset.name)
            );
            const newsResults = await Promise.all(newsPromises);
            
            const newNewsState: { [ticker: string]: GenerateAssetNewsOutput } = {};
            const newTargetPrices: { [ticker: string]: number } = {};
            
            // 3. Calculate the initial "target price" for each asset based on news
            newsResults.forEach((result, index) => {
                const asset = initialAssetsList[index];
                newNewsState[asset.ticker] = result.news;
                
                const cumulativeImpact = result.news.reduce((acc, item) => acc + item.impactScore, 0);
                
                // An impact score of 10 translates to a 5% target change.
                // Max impact of 3 news items (30) becomes a 15% target change.
                const impactFactor = (cumulativeImpact * 0.5) / 100;
                newTargetPrices[asset.ticker] = initialAssetsWithPrices[asset.ticker].price * (1 + impactFactor);
            });
            
            setNews(newNewsState);
            setTargetPrices(newTargetPrices);
            
            setLoading(false);
        };

        initializeMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (loading) return;

        const intervalId = setInterval(() => {
            const now = Date.now();
            const currentAssets = assetsRef.current;
            const currentHistoricalData = historicalDataRef.current;
            const currentTargetPrices = targetPricesRef.current;
            
            const newAssetsMap: AssetsMap = { ...currentAssets };
            const newHistoricalDataMap: HistoricalDataMap = { ...currentHistoricalData };

            for (const ticker in newAssetsMap) {
                const currentAsset = newAssetsMap[ticker];
                if (!currentAsset) continue;
                
                const targetPrice = currentTargetPrices[ticker] || currentAsset.price;
                const newPrice = calculateNextPrice(currentAsset.price, targetPrice, ticker, now);
                
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

    const getNewsForTicker = useCallback((ticker: string): GenerateAssetNewsOutput | undefined => {
        return news[ticker];
    }, [news]);

    const assetsArray = React.useMemo(() => Object.values(assets), [assets]);

    const value = {
        assets: assetsArray,
        getAssetByTicker,
        getHistoricalData,
        loading,
        getNewsForTicker,
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
