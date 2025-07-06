
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from '@/components/ui/button';
import { useMarketData } from '@/context/market-data-context';
import type { DetailedAsset } from '@/lib/assets';
import type { GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';
import { getOrGenerateAssetNews } from '@/lib/actions/news';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, TrendingDown, TrendingUp, Newspaper } from 'lucide-react';
import { subDays, format, parseISO } from 'date-fns';

type TimeRange = '1D' | '7D' | '1M' | '3M' | '1Y' | 'ALL';

interface AssetChartClientProps {
  asset: DetailedAsset;
}

export function AssetChartClient({ asset }: AssetChartClientProps) {
  const { getHistoricalData, registerNewsEvent } = useMarketData();
  const historicalData = getHistoricalData(asset.ticker);

  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [news, setNews] = useState<GenerateAssetNewsOutput>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      if (!asset?.ticker) return;

      setIsLoadingNews(true);
      setNews([]);
      const { news: freshNews, source } = await getOrGenerateAssetNews(asset.ticker, asset.name);
      setNews(freshNews);
      setIsLoadingNews(false);

      if (source === 'generated' && freshNews) {
        freshNews.forEach(item => {
            if (item.sentiment !== 'neutral') {
                registerNewsEvent(asset.ticker, item.sentiment);
            }
        });
      }
    }

    fetchNews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.ticker, asset?.name]);

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
        startDate = subDays(now, 90);
        break;
      case '1Y':
        startDate = subDays(now, 365);
        break;
      case 'ALL':
        return historicalData;
      default:
        // Default to 1M if something is wrong
        startDate = subDays(now, 30);
        break;
    }
    // Filter the data based on the calculated start date
    return historicalData.filter(d => parseISO(d.date) >= startDate);
  }, [timeRange, historicalData]);

  const yAxisDomain = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return ['auto', 'auto'];
    }
    
    const prices = filteredData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // If the line is flat, create a small 1% window around the price
    if (minPrice === maxPrice) {
      return [minPrice * 0.995, maxPrice * 1.005];
    }

    const priceRange = maxPrice - minPrice;
    
    // For the 1D view, which can have smaller variations, we use a larger
    // padding multiplier to ensure the chart feels "zoomed in".
    const paddingMultiplier = timeRange === '1D' ? 0.4 : 0.1;
    const padding = priceRange * paddingMultiplier;
    
    return [minPrice - padding, maxPrice + padding];
  }, [filteredData, timeRange]);

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
  
  const sentimentIcon = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Newspaper className="h-5 w-5 text-muted-foreground" />;
    }
  };
  
  const renderNewsContent = () => {
    if (isLoadingNews) {
      return (
        <div className="flex h-[140px] items-center justify-center">
           <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (news && news.length > 0) {
        if (news.length === 1 && news[0].headline.includes('Erreur de chargement')) {
             return (
                <Alert variant="destructive" className="h-full flex flex-col justify-center min-h-[140px]">
                    <div className="flex items-center gap-2">
                        {sentimentIcon(news[0].sentiment)}
                        <AlertTitle>{news[0].headline}</AlertTitle>
                    </div>
                    <AlertDescription className="mt-2">
                        {news[0].article}
                    </AlertDescription>
                </Alert>
            )
        }
        return (
            <Carousel className="w-full" opts={{ loop: news.length > 1 }}>
              <CarouselContent>
                {news.map((item, index) => (
                  <CarouselItem key={index}>
                    <div className="p-1">
                      <Alert className="h-full flex flex-col justify-center min-h-[140px]">
                          <div className="flex items-center gap-2">
                              {sentimentIcon(item.sentiment)}
                              <AlertTitle>{item.headline}</AlertTitle>
                          </div>
                          <AlertDescription className="mt-2">
                              {item.article}
                          </AlertDescription>
                      </Alert>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {news.length > 1 && (
                <>
                    <CarouselPrevious />
                    <CarouselNext />
                </>
              )}
            </Carousel>
        );
    }
    
    return (
        <Alert variant="default" className="bg-muted/50 h-full flex flex-col justify-center min-h-[140px]">
            <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-muted-foreground" />
                <AlertTitle>Aucune actualité récente</AlertTitle>
            </div>
            <AlertDescription className="mt-2">
                Il n'y a pas d'actualité générée par l'IA pour cet actif pour le moment.
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
                                domain={yAxisDomain}
                                // Instead of `hide`, we make the axis invisible but keep it for layout,
                                // ensuring the scaling is calculated correctly.
                                width={1}
                                tick={false}
                                axisLine={false}
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
                    <CardDescription>Derniers événements générés par l'IA.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderNewsContent()}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
