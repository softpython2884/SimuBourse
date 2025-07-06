'use client';

import { useState, useMemo, useEffect } from 'react';
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
import type { GenerateAssetNewsOutput } from '@/ai/flows/generate-asset-news';
import { getOrGenerateAssetNews } from '@/lib/actions/news';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Loader2, TrendingDown, TrendingUp, Newspaper } from 'lucide-react';
import { subDays, subHours, format, parseISO } from 'date-fns';
import { AssetFromDb } from '@/lib/actions/assets';

type TimeRange = '1H' | '1D';

interface AssetChartClientProps {
  asset: AssetFromDb;
}

export function AssetChartClient({ asset }: AssetChartClientProps) {
  const { getHistoricalData } = useMarketData();
  const historicalData = getHistoricalData(asset.ticker);
  
  const [news, setNews] = useState<GenerateAssetNewsOutput | undefined>(undefined);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  useEffect(() => {
    async function fetchNews() {
        setIsLoadingNews(true);
        const result = await getOrGenerateAssetNews(asset.ticker, asset.name);
        setNews(result.news);
        setIsLoadingNews(false);
    }
    fetchNews();
  }, [asset.ticker, asset.name]);


  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  
  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '1H':
        startDate = subHours(now, 1);
        break;
      case '1D':
      default:
        startDate = subDays(now, 1);
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

    // If the line is completely flat, create a small window to avoid errors
    if (minPrice === maxPrice) {
      return [minPrice * 0.995, maxPrice * 1.005];
    }

    const priceRange = maxPrice - minPrice;
    
    // For the 1H/1D view, if the price variation is very small (e.g., <1%),
    // we create an artificial window to make the changes visible.
    // This prevents the chart from looking flat.
    if ((timeRange === '1H' || timeRange === '1D') && (priceRange / minPrice) < 0.01) { // less than 1% variation
        const midPrice = (minPrice + maxPrice) / 2;
        const artificialPadding = midPrice * 0.005; // Creates a 1% total window
        return [midPrice - artificialPadding, midPrice + artificialPadding];
    }

    // For other time ranges or larger 1D variations, use a standard 10% padding.
    const padding = priceRange * 0.1;
    
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
    // Both 1H and 1D show time, so no switch needed
    return format(date, 'HH:mm');
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
                        {(['1H', '1D'] as TimeRange[]).map((range) => (
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
