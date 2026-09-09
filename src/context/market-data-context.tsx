'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { getAssets, AssetFromDb } from '@/lib/actions/assets';
import { subDays } from 'date-fns';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: AssetFromDb };
type HistoricalDataMap = { [ticker: string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: AssetFromDb[];
    getAssetByTicker: (ticker: string) => AssetFromDb | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
    refreshData: () => Promise<void>;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const MAX_HISTORY_POINTS = 100;

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});
    const eventSourceRef = useRef<EventSource | null>(null);

    const initializeMarket = useCallback(async () => {
        setLoading(true);
        const assetsData = await getAssets();

        const assetsMap = assetsData.reduce((acc, asset) => {
            acc[asset.ticker] = asset;
            return acc;
        }, {} as AssetsMap);

        setAssets(assetsMap);

        // Synthesize a 24h history seeded from the current price so charts have
        // something to draw before any SSE ticks accumulate.
        const now = Date.now();
        const initialHist: HistoricalDataMap = {};
        for (const ticker in assetsMap) {
            const asset = assetsMap[ticker];
            const oneDayAgo = subDays(now, 1).getTime();
            const data: HistoricalDataPoint[] = [];
            for (let i = 0; i < 48; i++) {
                const timestamp = oneDayAgo + i * 30 * 60 * 1000;
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

    // Subscribe to server-sent price updates. The server is the source of truth —
    // trades execute at the same price the user sees here.
    useEffect(() => {
        if (loading) return;
        if (typeof window === 'undefined') return;

        const es = new EventSource('/api/prices/stream');
        eventSourceRef.current = es;

        es.addEventListener('prices', (ev) => {
            try {
                const updates = JSON.parse((ev as MessageEvent).data) as Array<{
                    ticker: string;
                    price: number;
                    change24h: string;
                    type: string;
                }>;
                if (!Array.isArray(updates)) return;

                setAssets(prev => {
                    const next = { ...prev };
                    for (const u of updates) {
                        const existing = next[u.ticker];
                        if (existing) {
                            next[u.ticker] = { ...existing, price: u.price, change24h: u.change24h };
                        }
                    }
                    return next;
                });

                setHistoricalData(prev => {
                    const next = { ...prev };
                    const nowIso = new Date().toISOString();
                    for (const u of updates) {
                        const series = next[u.ticker] ?? [];
                        next[u.ticker] = [...series, { date: nowIso, price: u.price }].slice(-MAX_HISTORY_POINTS);
                    }
                    return next;
                });
            } catch (err) {
                console.error('Failed to parse SSE price event:', err);
            }
        });

        es.onerror = () => {
            // Browser will auto-reconnect; nothing to do here.
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, [loading]);

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
