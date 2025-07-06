'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { AssetFromDb } from '@/lib/actions/assets';
import { useMarketData } from '@/context/market-data-context';
import { TradeDialog } from './trade-dialog';
import Link from 'next/link';
import { Badge } from "./ui/badge";

export function AssetCard({ asset }: { asset: AssetFromDb }) {
    const { getHistoricalData } = useMarketData();
    const historicalData = getHistoricalData(asset.ticker);
    
    const changeIsPositive = asset.change24h.startsWith('+');
    const chartConfig = {
        price: {
            label: 'Prix',
            color: changeIsPositive ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))',
        },
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base">{asset.name} ({asset.ticker})</CardTitle>
                        <CardDescription>{asset.marketCap}</CardDescription>
                    </div>
                     <Badge variant="outline">{asset.type}</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="h-[100px] w-full -translate-x-4">
                    <ChartContainer config={chartConfig}>
                        <AreaChart
                            accessibilityLayer
                            data={historicalData}
                            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                        >
                             <defs>
                                <linearGradient id={`fill-chart-${asset.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <Tooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" hideLabel />}
                            />
                            <Area
                                dataKey="price"
                                type="natural"
                                fill={`url(#fill-chart-${asset.ticker})`}
                                strokeWidth={2}
                                stroke="var(--color-price)"
                                stackId="a"
                            />
                        </AreaChart>
                    </ChartContainer>
                </div>
                <div>
                     <div className="text-xl font-bold">${asset.price.toFixed(asset.price > 10 ? 2 : 4)}</div>
                     <p className={`text-xs ${changeIsPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {asset.change24h} (24h)
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button asChild variant="outline" size="sm">
                    <Link href={`/trading/${asset.ticker}`}>Détails</Link>
                </Button>
                <TradeDialog asset={asset} tradeType="Buy">
                    <Button size="sm">Acheter</Button>
                </TradeDialog>
            </CardFooter>
        </Card>
    );
}
