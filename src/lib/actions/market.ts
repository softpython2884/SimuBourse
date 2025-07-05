'use server';

import { db } from '@/lib/firebase';
import { assets as initialAssets } from '@/lib/assets';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  Timestamp,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { generateAssetNews } from '@/ai/flows/generate-asset-news';
import type { DetailedAsset } from '../assets';

const MARKET_UPDATE_INTERVAL_MINUTES = 1; // Mettre à jour toutes les 1 minute

// S'assure que le marché est initialisé dans Firestore
async function seedMarketData() {
  const marketStateRef = collection(db, 'market_state');
  const snapshot = await getDocs(marketStateRef);

  if (snapshot.empty) {
    console.log('Initialisation du marché dans Firestore...');
    const batch = writeBatch(db);

    for (const asset of initialAssets) {
      const assetRef = doc(marketStateRef, asset.ticker);
      const initialData = {
        name: asset.name,
        ticker: asset.ticker,
        price: asset.price,
        type: asset.type,
        description: asset.description,
        marketCap: asset.marketCap,
        change24h: asset.change24h,
        lastUpdate: Timestamp.now(),
        initialPrice24h: asset.price,
      };
      batch.set(assetRef, initialData);

      // Initialiser les données historiques
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
    console.log('Marché initialisé.');
  }
}

// Le cœur du moteur de simulation
export async function updateMarketData() {
  await seedMarketData();

  try {
    await runTransaction(db, async (transaction) => {
      const marketStateRef = collection(db, 'market_state');
      const assetsSnapshot = await getDocs(marketStateRef);

      const now = Timestamp.now();
      const twentyFourHoursAgo = new Timestamp(now.seconds - 24 * 60 * 60, now.nanoseconds);

      for (const assetDoc of assetsSnapshot.docs) {
        const assetData = assetDoc.data() as DetailedAsset & {
          lastUpdate: Timestamp;
          initialPrice24h: number;
        };
        const minutesSinceLastUpdate = (now.seconds - assetData.lastUpdate.seconds) / 60;

        if (minutesSinceLastUpdate < MARKET_UPDATE_INTERVAL_MINUTES) {
          continue; // Pas besoin de mettre à jour
        }
        
        // --- Calcul du nouveau prix ---
        let baseFluctuation = (Math.random() - 0.5) * 0.005; // Volatilité de base (+/- 0.25%)
        let sentimentModifier = 0;

        // Influence de l'IA
        const newsDocRef = doc(db, 'asset_news', assetData.ticker);
        const newsDoc = await getDoc(newsDocRef);
        let newsIsStale = true;
        let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

        if (newsDoc.exists() && newsDoc.data().generatedAt.toMillis() > twentyFourHoursAgo.toMillis()) {
          sentiment = newsDoc.data().sentiment;
          newsIsStale = false;
        }

        if (newsIsStale) {
          try {
            const result = await generateAssetNews({ ticker: assetData.ticker, name: assetData.name });
            sentiment = result.sentiment;
            const dataToCache = { ...result, generatedAt: Timestamp.now() };
            // Note: la transaction ne peut pas écrire ici, on fera ça plus tard
            await setDoc(newsDocRef, dataToCache); // Écriture hors transaction
          } catch (e) { console.error(`Impossible de générer les news pour ${assetData.ticker}`, e) }
        }
        
        if (sentiment === 'positive') sentimentModifier = 0.002; // Dérive positive
        if (sentiment === 'negative') sentimentModifier = -0.002; // Dérive négative

        const totalChangeFactor = 1 + baseFluctuation + sentimentModifier;
        let newPrice = assetData.price * totalChangeFactor;
        newPrice = Math.max(newPrice, 0.01); // Éviter les prix nuls

        // --- Mise à jour de la variation sur 24h ---
        const change = newPrice - assetData.initialPrice24h;
        const changePercent = (change / assetData.initialPrice24h) * 100;
        const newChange24h = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;

        // --- Mise à jour dans Firestore ---
        const assetRef = doc(marketStateRef, assetData.ticker);
        transaction.update(assetRef, {
          price: newPrice,
          change24h: newChange24h,
          lastUpdate: now,
        });

        // Ajouter un point à l'historique
        const historyPointsRef = collection(db, 'historical_data', assetData.ticker, 'points');
        const newPointRef = doc(historyPointsRef);
        transaction.set(newPointRef, { date: now, price: newPrice });
      }
    });
  } catch (error) {
    console.error("Échec de la transaction de mise à jour du marché:", error);
  }
}
