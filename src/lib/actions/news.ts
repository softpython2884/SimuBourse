'use server';

import { db } from '@/lib/db';
import { aiNews } from '@/lib/db/schema';
import { generateAssetNews, GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';
import { eq, and, gt, desc } from 'drizzle-orm';
import { subDays } from 'date-fns';

export async function getOrGenerateAssetNews(ticker: string, name: string): Promise<GenerateAssetNewsOutput> {
    const twentyFourHoursAgo = subDays(new Date(), 1);
    try {
        const recentNews = await db.query.aiNews.findMany({
            where: and(
                eq(aiNews.ticker, ticker),
                gt(aiNews.createdAt, twentyFourHoursAgo)
            ),
            orderBy: [desc(aiNews.createdAt)],
            limit: 3,
        });

        if (recentNews.length > 0) {
            return recentNews.map(news => ({
                headline: news.headline,
                article: news.article,
                sentiment: news.sentiment as 'positive' | 'negative' | 'neutral',
            }));
        }

        const generatedNews = await generateAssetNews({ ticker, name });

        if (generatedNews && generatedNews.length > 0) {
             await db.insert(aiNews).values(
                generatedNews.map(item => ({
                    ticker,
                    ...item,
                }))
            );
        }
        
        return generatedNews;

    } catch (error) {
        console.error(`Failed to get or generate news for ${ticker}:`, error);
        return [{
            headline: 'Erreur de chargement des actualités',
            article: 'Impossible de récupérer ou de générer les dernières actualités pour cet actif.',
            sentiment: 'neutral'
        }];
    }
}
