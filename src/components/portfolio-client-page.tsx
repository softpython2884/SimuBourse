
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePortfolio } from '@/context/portfolio-context';
import { useMarketData } from '@/context/market-data-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TradeDialog } from '@/components/trade-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { AssetFromDb } from '@/lib/actions/assets';
import { SellSharesDialog } from './sell-shares-dialog';

export default function PortfolioClientPage() {
    const { holdings, cash, initialCash, loading, userProfile } = usePortfolio();
    const { getAssetByTicker, assets: marketAssets, loading: marketLoading } = useMarketData();

    const holdingsWithMarketData = useMemo(() => {
        if (marketLoading && !marketAssets.length && !userProfile) return []; 
        
        return holdings.map(holding => {
            const isCompany = holding.type === 'Company Share';
            const asset = !isCompany ? getAssetByTicker(holding.ticker) : undefined;
            
            const currentPrice = isCompany 
                ? (holding.company?.sharePrice || holding.avgCost) 
                : (asset?.price || holding.avgCost);
            
            const currentValue = holding.quantity * currentPrice;
            const totalCost = holding.quantity * holding.avgCost;
            const pnl = currentValue - totalCost;
            const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
            return {
                ...holding,
                asset: asset,
                isCompanyShare: isCompany,
                currentPrice,
                currentValue,
                pnl,
                pnlPercent
            };
        }).sort((a, b) => b.currentValue - a.currentValue);
    }, [holdings, getAssetByTicker, marketAssets, marketLoading, userProfile]);
    
    const assetsValue = useMemo(() => holdingsWithMarketData.reduce((sum, holding) => sum + holding.currentValue, 0), [holdingsWithMarketData]);
    const portfolioValue = assetsValue + cash;
    const totalPortfolioPnL = portfolioValue - initialCash;
    const totalPortfolioPnLPercent = initialCash > 0 ? (totalPortfolioPnL / initialCash) * 100 : 0;

    if (loading || marketLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Portfolio Summary</CardTitle>
                    <CardDescription>An overview of your investment performance.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Total Value</span>
                        <span className="text-2xl font-bold">${portfolioValue.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Available Funds</span>
                        <span className="text-2xl font-bold">${cash.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Total Gains/Losses</span>
                         <span className={`text-2xl font-bold ${totalPortfolioPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalPortfolioPnL >= 0 ? '+' : '-'}${Math.abs(totalPortfolioPnL).toFixed(2)} ({totalPortfolioPnLPercent.toFixed(2)}%)
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>My Assets</CardTitle>
                    <CardDescription>Detailed list of all assets you own.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Current Price</TableHead>
                                <TableHead>Current Value</TableHead>
                                <TableHead>Gains/Losses</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {holdingsWithMarketData.length > 0 ? (
                                holdingsWithMarketData.map(holding => (
                                    <TableRow key={`${holding.ticker}-${holding.isCompanyShare}`}>
                                        <TableCell>
                                            <div className="font-medium">{holding.name}</div>
                                            <div className="text-sm text-muted-foreground">{holding.ticker}</div>
                                        </TableCell>
                                        <TableCell>{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</TableCell>
                                        <TableCell>${holding.currentPrice.toFixed(holding.currentPrice > 10 ? 2 : 4)}</TableCell>
                                        <TableCell>${holding.currentValue.toFixed(2)}</TableCell>
                                        <TableCell className={holding.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                            <div className="font-semibold">{holding.pnl >= 0 ? '+' : '-'}${Math.abs(holding.pnl).toFixed(2)}</div>
                                            <div className="text-xs">({holding.pnlPercent.toFixed(2)}%)</div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {holding.isCompanyShare ? (
                                                <>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/companies/${holding.id}`}>Details</Link>
                                                    </Button>
                                                    <SellSharesDialog
                                                        companyId={holding.id}
                                                        companyName={holding.name}
                                                        sharePrice={holding.currentPrice}
                                                        sharesHeld={holding.quantity}
                                                        isListed={holding.company?.isListed}
                                                    >
                                                        <Button variant="secondary" size="sm">Sell</Button>
                                                    </SellSharesDialog>
                                                </>
                                            ) : (
                                                <>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/trading/${holding.asset!.ticker}`}>Details</Link>
                                                    </Button>
                                                    {holding.asset ? (
                                                        <TradeDialog asset={holding.asset as AssetFromDb} tradeType="Sell">
                                                            <Button variant="secondary" size="sm">Sell</Button>
                                                        </TradeDialog>
                                                    ) : (
                                                        <Button variant="secondary" size="sm" disabled>Sell</Button>
                                                    )}
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        You don't own any assets at the moment.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
