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
  setDoc,
} from 'firebase/firestore';
import { assets as initialAssets, DetailedAsset } from '@/lib/assets';
import { useAuth } from './auth-context';

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

const MARKET_UPDATE_INTERVAL_SECONDS = 60; // Update every minute when a user is active
const VOLATILITY_FACTOR = 0.05; // Increased volatility for more noticeable price swings

async function updateMarketData() {
  console.log('Checking if market data needs seeding or updating...');
  
  const marketStateRef = collection(db, 'market_state');
  const assetsSnapshot = await getDocs(marketStateRef);

  if (assetsSnapshot.empty) {
    console.log('Initialising market in Firestore...');
    const batch = writeBatch(db);
    for (const asset of initialAssets) {
      const assetRef = doc(marketStateRef, asset.ticker);
      const initialData = {
        ...asset,
        lastUpdate: Timestamp.now(),
        initialPrice24h: asset.price,
      };
      batch.set(assetRef, initialData);

      const historyRef = doc(collection(db, 'historical_data'), asset.ticker);
      batch.set(historyRef, { lastUpdate: Timestamp.now() });

      const pointsRef = collection(historyRef, 'points');
      const initialPointRef = doc(pointsRef);
      batch.set(initialPointRef, {
        date: Timestamp.now(),
        price: asset.price,
      });
    }
    await batch.commit();
    console.log('Market initialised.');
    return; // Exit after seeding
  }

  try {
    const assetDocs = await getDocs(query(collection(db, 'market_state')));
    
    await runTransaction(db, async (transaction) => {
        console.log('Running market update transaction...');
        const now = Timestamp.now();
        const twentyFourHoursAgo = new Timestamp(now.seconds - 24 * 60 * 60, now.nanoseconds);

        for (const assetDoc of assetDocs.docs) {
            const assetData = assetDoc.data() as DetailedAsset & { lastUpdate: Timestamp, initialPrice24h: number };
            const secondsSinceLastUpdate = now.seconds - assetData.lastUpdate.seconds;
            
            // This simulates updates that would have happened "offline"
            const intervalsToSimulate = Math.floor(secondsSinceLastUpdate / MARKET_UPDATE_INTERVAL_SECONDS);

            if (intervalsToSimulate < 1) {
                continue; // This asset is up-to-date
            }
            
            console.log(`Simulating ${intervalsToSimulate} intervals for ${assetData.ticker}`);

            let newPrice = assetData.price;
            let lastSimulatedDate = assetData.lastUpdate;

            // Get news sentiment once before the loop
            const newsDocRef = doc(db, 'asset_news', assetData.ticker);
            const newsDoc = await getDoc(newsDocRef);
            let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (newsDoc.exists() && newsDoc.data().generatedAt.toMillis() > twentyFourHoursAgo.toMillis()) {
                sentiment = newsDoc.data().sentiment;
            }
            const sentimentModifier = sentiment === 'positive' ? 0.005 : sentiment === 'negative' ? -0.005 : 0;

            // Simulate each missed interval
            for (let i = 0; i < intervalsToSimulate; i++) {
                const baseFluctuation = (Math.random() - 0.5) * VOLATILITY_FACTOR;
                const totalChangeFactor = 1 + baseFluctuation + sentimentModifier;
                newPrice *= totalChangeFactor;
                newPrice = Math.max(newPrice, 0.01);
                
                // Add a new historical point for each simulated interval
                lastSimulatedDate = new Timestamp(lastSimulatedDate.seconds + MARKET_UPDATE_INTERVAL_SECONDS, 0);
                const historyPointsRef = collection(db, 'historical_data', assetData.ticker, 'points');
                const newPointRef = doc(historyPointsRef);
                transaction.set(newPointRef, { date: lastSimulatedDate, price: newPrice });
            }

            const change = newPrice - assetData.initialPrice24h;
            const changePercent = (change / assetData.initialPrice24h) * 100;
            const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

            const assetRef = doc(db, 'market_state', assetData.ticker);
            transaction.update(assetRef, {
                price: newPrice,
                change24h: newChange24h,
                lastUpdate: now,
            });
        }
    });
    console.log('Market update transaction completed successfully.');
  } catch (error) {
    console.error("Failed to run market update transaction:", error);
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
            if (snapshot.empty) {
              console.log("Market state is empty, attempting to seed.");
              updateMarketData().then(() => setLoading(false)).catch(console.error);
              return;
            }

            const newAssetsData: AssetsMap = {};
            snapshot.forEach((doc) => {
                newAssetsData[doc.id] = doc.data() as DetailedAsset;
            });
            setAssets(newAssetsData);
            
            // Subscribe to historical data for each asset
            snapshot.docs.forEach(doc => {
                const ticker = doc.id;
                if (!historicalData[ticker] || unsubscribeFunctions.length <= snapshot.docs.length) { // Prevent resubscribing
                    const pointsCollectionRef = collection(db, 'historical_data', ticker, 'points');
                    const q = query(pointsCollectionRef, orderBy('date', 'desc'), limit(1440)); // ~24h of data if 1 point/min
                    
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
