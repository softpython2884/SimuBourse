'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { DetailedAsset } from '@/lib/assets';

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
    const noise = (sin1 * 0.02) + (sin2 * 0.015) + (sin3 * 0.005); // Max ~4% total volatility
    
    // Force a "mean reversion" to prevent prices from drifting too far
    const reversionStrength = 0.05; 
    const drift = noise - (reversionStrength * noise);

    return initialPrice * (1 + drift);
};


export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});
    const [initialAssetsMap, setInitialAssetsMap] = useState<AssetsMap>({});

    // This effect runs once to fetch the initial state of the market from Firestore.
    useEffect(() => {
        console.log("Fetching initial market state...");
        const assetsQuery = query(collection(db, 'market_state'));
        
        const assetsUnsubscribe = onSnapshot(assetsQuery, async (snapshot) => {
            if (snapshot.empty) {
                console.log("Market state is empty. Seeding is handled by a separate function if needed.");
                setLoading(false);
                return;
            }

            const newAssetsData: AssetsMap = {};
            const historicalDataPromises: Promise<void>[] = [];

            snapshot.forEach((doc) => {
                const assetData = doc.data() as DetailedAsset;
                newAssetsData[doc.id] = assetData;

                const ticker = doc.id;
                const pointsCollectionRef = collection(db, 'historical_data', ticker, 'points');
                const q = query(pointsCollectionRef, orderBy('date', 'desc'), limit(1440));
                
                historicalDataPromises.push(
                    getDocs(q).then(pointsSnapshot => {
                        const points = pointsSnapshot.docs.map(pointDoc => {
                            const data = pointDoc.data();
                            return {
                                price: data.price,
                                date: (data.date as Timestamp).toDate().toISOString(),
                            };
                        }).reverse();
                        
                        setHistoricalData(prev => ({ ...prev, [ticker]: points }));
                    })
                );
            });
            
            await Promise.all(historicalDataPromises);
            
            setAssets(newAssetsData);
            setInitialAssetsMap(newAssetsData); // Save the initial state for the simulation baseline
            setLoading(false);
            console.log("Initial market state loaded.");
        }, (error) => {
            console.error("Firebase market_state listener error:", error);
            setLoading(false);
        });
        
        return () => {
            assetsUnsubscribe();
        };
    }, []);

    // This effect runs the client-side simulation loop once the initial data is loaded.
    useEffect(() => {
        if (Object.keys(initialAssetsMap).length === 0 || loading) return;

        console.log("Starting client-side market simulation.");
        const intervalId = setInterval(() => {
            const now = Date.now();
            const today = new Date(now);

            // Functional updates ensure we always have the latest state without stale closures.
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
                for (const ticker in prevHist) {
                    const initialAsset = initialAssetsMap[ticker];
                    if (!initialAsset) continue;
                    
                    const newPrice = calculateDeterministicPrice(initialAsset.price, ticker, now);
                    const newPoint = { date: today.toISOString(), price: newPrice };
                    const history = newHist[ticker] ? [...newHist[ticker], newPoint] : [newPoint];
                    
                    // Keep history from growing too large in memory
                    newHist[ticker] = history.slice(-1500); 
                }
                return newHist;
            });
        }, 2000); // Update every 2 seconds

        return () => {
            console.log("Stopping client-side market simulation.");
            clearInterval(intervalId);
        }
    }, [initialAssetsMap, loading]);


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
