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
  writeBatch,
  doc,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { assets as initialAssets, DetailedAsset } from '@/lib/assets';
import { useAuth } from './auth-context';

export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type FirestoreAsset = DetailedAsset & {
    lastUpdate: Timestamp;
    price24hAgo: number;
    price24hAgoLastUpdate: Timestamp;
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

export const MARKET_UPDATE_INTERVAL_SECONDS = 60; // Update every minute when a user is active
const OFFLINE_SIMULATION_INTERVAL_SECONDS = 3600; // Simulate every hour for offline catch-up
const VOLATILITY_FACTOR = 0.0005; // Base fluctuation for live updates

async function updateMarketData() {
  console.log('Checking if market data needs seeding or updating...');
  
  const marketStateRef = collection(db, 'market_state');
  
  // --- Seed new assets not present in Firestore ---
  const existingAssetsSnapshot = await getDocs(marketStateRef);
  const existingTickers = new Set(existingAssetsSnapshot.docs.map(d => d.id));
  const batch = writeBatch(db);
  let hasNewAssets = false;

  for (const asset of initialAssets) {
    if (!existingTickers.has(asset.ticker)) {
      hasNewAssets = true;
      console.log(`New asset found: ${asset.ticker}. Seeding...`);
      const assetRef = doc(marketStateRef, asset.ticker);
      const now = Timestamp.now();
      const initialData = {
        ...asset,
        lastUpdate: now,
        price24hAgo: asset.price,
        price24hAgoLastUpdate: now,
      };
      batch.set(assetRef, initialData);

      const historyRef = doc(collection(db, 'historical_data'), asset.ticker);
      const historyDoc = await getDoc(historyRef);
      if (!historyDoc.exists()) {
        batch.set(historyRef, { lastUpdate: now });
        const pointsRef = collection(historyRef, 'points');
        const initialPointRef = doc(pointsRef);
        batch.set(initialPointRef, { date: now, price: asset.price });
      }
    }
  }
  if (hasNewAssets) {
    await batch.commit();
    console.log('New assets have been seeded.');
  }

  // --- Run simulation for time passed since last update ---
  try {
    const assetDocs = await getDocs(query(collection(db, 'market_state')));
    
    await runTransaction(db, async (transaction) => {
        console.log('Running market simulation...');
        const now = Timestamp.now();

        for (const assetDoc of assetDocs.docs) {
            const assetRef = doc(db, 'market_state', assetDoc.id);
            const assetData = assetDoc.data() as FirestoreAsset;
            const secondsSinceLastUpdate = now.seconds - (assetData.lastUpdate?.seconds || 0);

            if (secondsSinceLastUpdate < MARKET_UPDATE_INTERVAL_SECONDS) {
                continue; // Already up-to-date
            }

            // AI News sentiment modifier
            const newsDocRef = doc(db, 'asset_news', assetData.ticker);
            const newsDocSnap = await transaction.get(newsDocRef);
            const sentiment = newsDocSnap.exists() ? newsDocSnap.data().sentiment : 'neutral';
            const sentimentModifier = sentiment === 'positive' ? VOLATILITY_FACTOR / 2 : sentiment === 'negative' ? -VOLATILITY_FACTOR / 2 : 0;
            
            let newPrice = assetData.price;
            let lastSimulatedDate = assetData.lastUpdate || now;

            // Catch-up simulation for offline periods
            const offlineIntervals = Math.floor(secondsSinceLastUpdate / OFFLINE_SIMULATION_INTERVAL_SECONDS);
            if (offlineIntervals > 0) {
                for (let i = 0; i < offlineIntervals; i++) {
                    const fluctuation = (Math.random() - 0.5) * 2 * (VOLATILITY_FACTOR * 10);
                    newPrice *= (1 + fluctuation + sentimentModifier);
                    newPrice = Math.max(newPrice, 0.01);
                    lastSimulatedDate = new Timestamp(lastSimulatedDate.seconds + OFFLINE_SIMULATION_INTERVAL_SECONDS, 0);
                    transaction.set(doc(collection(db, 'historical_data', assetData.ticker, 'points')), { date: lastSimulatedDate, price: newPrice });
                }
            }
            
            // Live simulation for active periods
            const remainingSeconds = secondsSinceLastUpdate % OFFLINE_SIMULATION_INTERVAL_SECONDS;
            const liveIntervals = Math.floor(remainingSeconds / MARKET_UPDATE_INTERVAL_SECONDS);
            if (liveIntervals > 0) {
                 for (let i = 0; i < liveIntervals; i++) {
                    const fluctuation = (Math.random() - 0.5) * 2 * VOLATILITY_FACTOR;
                    newPrice *= (1 + fluctuation + sentimentModifier);
                    newPrice = Math.max(newPrice, 0.01);
                    lastSimulatedDate = new Timestamp(lastSimulatedDate.seconds + MARKET_UPDATE_INTERVAL_SECONDS, 0);
                    transaction.set(doc(collection(db, 'historical_data', assetData.ticker, 'points')), { date: lastSimulatedDate, price: newPrice });
                }
            }

            // Update 24h reference price if needed
            let price24hAgo = assetData.price24hAgo || assetData.price;
            const needs24hUpdate = !assetData.price24hAgoLastUpdate || (now.seconds - assetData.price24hAgoLastUpdate.seconds > 24 * 3600);
            if (needs24hUpdate) {
                price24hAgo = assetData.price;
            }
            
            const change = newPrice - price24hAgo;
            const changePercent = (price24hAgo > 0) ? (change / price24hAgo) * 100 : 0;
            const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

            const updatePayload: { [key: string]: any } = {
                price: newPrice,
                change24h: newChange24h,
                lastUpdate: now,
            };
            if (needs24hUpdate) {
                updatePayload.price24hAgo = price24hAgo;
                updatePayload.price24hAgoLastUpdate = now;
            }
            transaction.update(assetRef, updatePayload);
        }
    });
    console.log('Market simulation completed successfully.');
  } catch (error) {
    console.error("Failed to run market simulation:", error);
  }
}


export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<AssetsMap>({});
    const [historicalData, setHistoricalData] = useState<HistoricalDataMap>({});

    useEffect(() => {
        if (user) {
            console.log("User logged in, starting market updates.");
            const performUpdate = () => updateMarketData().catch(err => {
              console.error("An error occurred during market update:", err);
            });
            
            performUpdate(); // Initial update on login

            const intervalId = setInterval(performUpdate, MARKET_UPDATE_INTERVAL_SECONDS * 1000);

            return () => {
                console.log("User session ending, stopping market updates.");
                clearInterval(intervalId);
            };
        }
    }, [user]);

    useEffect(() => {
        const unsubscribeFunctions: (() => void)[] = [];

        const assetsUnsubscribe = onSnapshot(collection(db, 'market_state'), (snapshot) => {
            if (snapshot.empty && !Object.keys(assets).length) {
              console.log("Market state is empty, attempting to seed.");
              updateMarketData().then(() => setLoading(false)).catch(console.error);
              return;
            }

            const newAssetsData: AssetsMap = {};
            snapshot.forEach((doc) => {
                newAssetsData[doc.id] = doc.data() as DetailedAsset;
            });
            setAssets(newAssetsData);
            
            snapshot.docs.forEach(doc => {
                const ticker = doc.id;
                if (!historicalData[ticker] || unsubscribeFunctions.length <= snapshot.docs.length) { 
                    const pointsCollectionRef = collection(db, 'historical_data', ticker, 'points');
                    const q = query(pointsCollectionRef, orderBy('date', 'desc'), limit(1440));
                    
                    const unsubscribe = onSnapshot(q, (pointsSnapshot) => {
                        const points = pointsSnapshot.docs.map(pointDoc => {
                            const data = pointDoc.data();
                            return {
                                price: data.price,
                                date: (data.date as Timestamp).toDate().toISOString(),
                            };
                        }).reverse();
                        
                        setHistoricalData(prev => ({ ...prev, [ticker]: points }));
                    }, (error) => {
                      console.error(`Error fetching historical data for ${ticker}:`, error);
                    });
                    unsubscribeFunctions.push(unsubscribe);
                }
            });
            setLoading(false);
        }, (error) => {
            console.error("Firebase market_state listener error:", error);
            setLoading(false);
        });
        
        unsubscribeFunctions.push(assetsUnsubscribe);

        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            {loading && !Object.keys(assets).length ? (
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
