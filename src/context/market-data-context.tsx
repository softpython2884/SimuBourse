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
import { generateAssetNews } from '@/ai/flows/generate-asset-news';


export type HistoricalDataPoint = {
    date: string;
    price: number;
};

type AssetsMap = { [ticker: string]: DetailedAsset };
type HistoricalDataMap = { [ticker: string]: HistoricalDataPoint[] };

interface MarketDataContextType {
    assets: DetailedAsset[];
    getAssetByTicker: (ticker: string) => DetailedAsset | undefined;
    getHistoricalData: (ticker: string) => HistoricalDataPoint[];
    loading: boolean;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const MARKET_UPDATE_INTERVAL_MINUTES = 1;

// This function now runs on the client, authenticated.
async function updateMarketData() {
  console.log('Checking if market data needs seeding or updating...');
  
  // 1. Seed data if it doesn't exist
  const marketStateRef = collection(db, 'market_state');
  const snapshot = await getDocs(marketStateRef);
  if (snapshot.empty) {
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
  }

  // 2. Run the update transaction
  try {
    await runTransaction(db, async (transaction) => {
      console.log('Running market update transaction...');
      const assetsSnapshot = await transaction.get(query(collection(db, 'market_state')));

      const now = Timestamp.now();
      const twentyFourHoursAgo = new Timestamp(now.seconds - 24 * 60 * 60, now.nanoseconds);
      let needsUpdate = false;

      // First, check if any asset actually needs an update to avoid unnecessary work
      for (const assetDoc of assetsSnapshot.docs) {
          const assetData = assetDoc.data() as DetailedAsset & { lastUpdate: Timestamp };
          const minutesSinceLastUpdate = (now.seconds - assetData.lastUpdate.seconds) / 60;
          if (minutesSinceLastUpdate >= MARKET_UPDATE_INTERVAL_MINUTES) {
              needsUpdate = true;
              break;
          }
      }

      if (!needsUpdate) {
        console.log('Market is up to date. No transaction needed.');
        return;
      }

      console.log('Market requires update. Proceeding with writes...');
      for (const assetDoc of assetsSnapshot.docs) {
        const assetData = assetDoc.data() as DetailedAsset & {
          lastUpdate: Timestamp;
          initialPrice24h: number;
        };

        const minutesSinceLastUpdate = (now.seconds - assetData.lastUpdate.seconds) / 60;
        if (minutesSinceLastUpdate < MARKET_UPDATE_INTERVAL_MINUTES) {
          continue;
        }

        let baseFluctuation = (Math.random() - 0.5) * 0.02; // Volatility
        let sentimentModifier = 0;
        
        const newsDocRef = doc(db, 'asset_news', assetData.ticker);
        // We use a direct getDoc here instead of transaction.get because we might write to it later outside the transaction.
        const newsDoc = await getDoc(newsDocRef);
        let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
        
        if (newsDoc.exists() && newsDoc.data().generatedAt.toMillis() > twentyFourHoursAgo.toMillis()) {
            sentiment = newsDoc.data().sentiment;
        }

        if (sentiment === 'positive') sentimentModifier = Math.random() * 0.01; // Positive drift
        if (sentiment === 'negative') sentimentModifier = Math.random() * -0.01; // Negative drift
        
        const totalChangeFactor = 1 + baseFluctuation + sentimentModifier;
        let newPrice = assetData.price * totalChangeFactor;
        newPrice = Math.max(newPrice, 0.01);

        const change = newPrice - assetData.initialPrice24h;
        const changePercent = (change / assetData.initialPrice24h) * 100;
        const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

        const assetRef = doc(db, 'market_state', assetData.ticker);
        transaction.update(assetRef, {
          price: newPrice,
          change24h: newChange24h,
          lastUpdate: now,
        });

        const historyPointsRef = collection(db, 'historical_data', assetData.ticker, 'points');
        const newPointRef = doc(historyPointsRef);
        transaction.set(newPointRef, { date: now, price: newPrice });
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
            updateMarketData().catch(err => {
              console.error("An error occurred during market update:", err);
            });
        }
    }, [user]);

    useEffect(() => {
        const unsubscribeFunctions: (() => void)[] = [];

        const assetsUnsubscribe = onSnapshot(collection(db, 'market_state'), (snapshot) => {
            const newAssetsData: AssetsMap = {};
            snapshot.forEach((doc) => {
                newAssetsData[doc.id] = doc.data() as DetailedAsset;
            });
            setAssets(newAssetsData);
            
            if (snapshot.docs.length > 0) {
              snapshot.docs.forEach(doc => {
                  const ticker = doc.id;
                  if (!historicalData[ticker]) { // Fetch only if not already fetched
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
            }
            setLoading(false);
        }, (error) => {
            console.error("Firebase market_state listener error:", error);
            setLoading(false);
        });
        
        unsubscribeFunctions.push(assetsUnsubscribe);

        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
        };
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
