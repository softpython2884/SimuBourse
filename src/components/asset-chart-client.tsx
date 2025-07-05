'use client';

import { useState, useEffect, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { HistoricalData } from '@/context/market-data-context';
import type { DetailedAsset } from '@/lib/assets';
import { generateAssetNews, GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, TrendingDown, TrendingUp, Newspaper, Lock } from 'lucide-react';
import { subDays, format, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';

type TimeRange = '1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL';

interface AssetChartClientProps {
  asset: DetailedAsset;
  initialHistoricalData: HistoricalData[];
}

export function AssetChartClient({ asset, initialHistoricalData }: AssetChartClientProps) {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [news, setNews] = useState<GenerateAssetNewsOutput | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    async function manageNews() {
        if (!asset) return;
        setIsLoadingNews(true);

        const newsDocRef = doc(db, 'asset_news', asset.ticker);
        
        try {
            const newsDoc = await getDoc(newsDocRef);
            const oneHourAgo = Timestamp.now().toMillis() - (60 * 60 * 1000);

            let isStale = true;
            if (newsDoc.exists()) {
                isStale = newsDoc.data().generatedAt.toMillis() < oneHourAgo;
            }

            if (isStale && user) {
                const result = await generateAssetNews({ ticker: asset.ticker, name: asset.name });
                const dataToCache = { ...result, generatedAt: Timestamp.now() };
                await setDoc(newsDocRef, dataToCache);
                setNews(result);
            } else if (newsDoc.exists()) {
                setNews(newsDoc.data() as GenerateAssetNewsOutput);
            } else {
                setNews(null);
            }
        } catch (error) {
            console.error("Failed to fetch or generate AI news:", error);
            setNews({ headline: 'Erreur de chargement', article: 'Impossible de récupérer les actualités.', sentiment: 'neutral' });
        } finally {
            setIsLoadingNews(false);
        }
    }
    manageNews();
  }, [asset, user]);

  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '1D':
        startDate = subDays(now, 1);
        break;
      case '7D':
        startDate = subDays(now, 7);
        break;
      case '1M':
        startDate = subDays(now, 30);
        break;
      case '3M':
      case '1Y':
      case 'ALL':
      default:
        return initialHistoricalData;
    }
    return initialHistoricalData.filter(d => parseISO(d.date) >= startDate);
  }, [timeRange, initialHistoricalData]);

  const chartConfig = {
    price: {
      label: 'Price',
      color: 'hsl(var(--chart-1))',
    },
  };

  const formatXAxis = (tickItem: string) => {
    const date = parseISO(tickItem);
    switch (timeRange) {
      case '1D':
        return format(date, 'HH:mm');
      case '7D':
        return format(date, 'EEE d');
      case '1M':
      case '3M':
      case '1Y':
      case 'ALL':
      default:
        return format(date, 'MMM d');
    }
  };
  
  const sentimentIcon = useMemo(() => {
    if (!news) return null;
    switch (news.sentiment) {
      case 'positive':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Newspaper className="h-5 w-5 text-muted-foreground" />;
    }
  }, [news]);
  
  const renderNewsContent = () => {
    if (isLoadingNews) {
      return (
        <div className="flex items-center justify-center h-24">
           <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (news) {
        return (
            <Alert>
                <div className="flex items-center gap-2">
                    {sentimentIcon}
                    <AlertTitle>{news.headline}</AlertTitle>
                </div>
                <AlertDescription className="mt-2">
                    {news.article}
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
         <Alert variant="default" className="bg-muted/50">
            <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <AlertTitle>Générer l'actualité du jour</AlertTitle>
            </div>
            <AlertDescription className="mt-2">
                Connectez-vous pour être le premier à générer l'analyse de l'IA pour cet actif.
            </AlertDescription>
        </Alert>
    )
  }


  return (
    <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle>Mouvement du Prix</CardTitle>
                        <CardDescription>
                            Graphique des prix pour {asset.name} ({asset.ticker})
                        </CardDescription>
                    </div>
                    <div className="flex gap-1">
                        {(['1D', '7D', '1M', '3M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                            <Button
                            key={range}
                            size="sm"
                            variant={timeRange === range ? 'default' : 'outline'}
                            onClick={() => setTimeRange(range)}
                            >
                            {range}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="h-[300px] w-full p-0">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <AreaChart
                            accessibilityLayer
                            data={filteredData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={formatXAxis}
                            />
                            <YAxis
                                domain={['dataMin', 'dataMax']}
                                hide
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Area
                                dataKey="price"
                                type="natural"
                                fill="var(--color-price)"
                                fillOpacity={0.4}
                                stroke="var(--color-price)"
                                stackId="a"
                            />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Actualités de l'IA</CardTitle>
                    <CardDescription>Dernier événement généré par l'IA.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderNewsContent()}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
