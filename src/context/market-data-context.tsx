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
    const [initialAssets, setInitialAssets] = useState<AssetsMap>({}); // To store original prices for % change
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    const initializeMarket = useCallback(async () => {
        setLoading(true);
        const assetsData = await getAssets();
        
        const assetsMap = assetsData.reduce((acc, asset) => {
            acc[asset.ticker] = asset;
            return acc;
        }, {} as AssetsMap);

        const initialAssetsMap = JSON.parse(JSON.stringify(assetsMap));

        setAssets(assetsMap);
        setInitialAssets(initialAssetsMap);

        // Generate a flat historical baseline for all assets for charting
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        for (const ticker in assetsMap) {
            const asset = assetsMap[ticker];
            const oneDayAgo = subDays(now, 1);
            const data: HistoricalDataPoint[] = [];
             // Generate 48 points for smoother chart
            for (let i = 0; i < 48; i++) {
                const timestamp = oneDayAgo.getTime() + i * 30 * 60 * 1000; // 30 min intervals
                // Add some randomness to the historical data to make it look real
                const priceFluctuation = asset.price * (1 + (Math.random() - 0.5) * 0.1);
                data.push({ date: new Date(timestamp).toISOString(), price: priceFluctuation });
            }
             data.push({ date: new Date(now).toISOString(), price: asset.price });
            initialHist[ticker] = data;
        }

        setHistoricalData(initialHist);
        setLoading(false);
    }, []);

    useEffect(() => {
        initializeMarket();
    }, [initializeMarket]);
    
    // EFFECT FOR MARKET SIMULATION
    useEffect(() => {
        if (loading || Object.keys(initialAssets).length === 0) return;

        const simulationInterval = setInterval(() => {
            setAssets(currentAssets => {
                const newAssets = { ...currentAssets };
                const updatedTickers: { [ticker: string]: number } = {};
                
                for (const ticker in newAssets) {
                    const asset = { ...newAssets[ticker] };
                    const initialPrice = initialAssets[ticker]?.price;
                    if (!initialPrice) continue;

                    // Simulate price change
                    const volatility = asset.type === 'Crypto' ? 0.0015 : 0.0005;
                    const changeFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
                    asset.price *= changeFactor;
                    updatedTickers[ticker] = asset.price;

                    // Update 24h change
                    const change = asset.price - initialPrice;
                    const changePercent = (change / initialPrice) * 100;
                    asset.change24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    
                    newAssets[ticker] = asset;
                }
                
                // Now update historical data based on the new prices
                setHistoricalData(currentHistData => {
                    const newHistData = { ...currentHistData };
                    for (const ticker in updatedTickers) {
                        const newPrice = updatedTickers[ticker];
                        const newPoint = { date: new Date().toISOString(), price: newPrice };
                        const updatedHistory = [...(newHistData[ticker] || []), newPoint].slice(-100);
                        newHistData[ticker] = updatedHistory;
                    }
                    return newHistData;
                });
                
                return newAssets;
            });
        }, 3000); // Update every 3 seconds

        return () => clearInterval(simulationInterval);
    }, [loading, initialAssets]);

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
