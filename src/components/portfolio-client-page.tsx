
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
                    <CardTitle>Synthèse du Portefeuille</CardTitle>
                    <CardDescription>Un aperçu de la performance de vos investissements.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Valeur Totale</span>
                        <span className="text-2xl font-bold">${portfolioValue.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Fonds Disponibles</span>
                        <span className="text-2xl font-bold">${cash.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                        <span className="text-sm text-muted-foreground">Gains/Pertes Totaux</span>
                         <span className={`text-2xl font-bold ${totalPortfolioPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalPortfolioPnL >= 0 ? '+' : '-'}${Math.abs(totalPortfolioPnL).toFixed(2)} ({totalPortfolioPnLPercent.toFixed(2)}%)
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Mes Actifs</CardTitle>
                    <CardDescription>Liste détaillée de tous les actifs que vous possédez.</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Desktop: full table */}
                    <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Actif</TableHead>
                                <TableHead>Quantité</TableHead>
                                <TableHead>Prix Actuel</TableHead>
                                <TableHead>Valeur Actuelle</TableHead>
                                <TableHead>Gains/Pertes</TableHead>
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
                                                        <Link href={`/companies/${holding.id}`}>Détails</Link>
                                                    </Button>
                                                    <SellSharesDialog
                                                        companyId={holding.id}
                                                        companyName={holding.name}
                                                        sharePrice={holding.currentPrice}
                                                        sharesHeld={holding.quantity}
                                                        isListed={holding.company?.isListed}
                                                    >
                                                        <Button variant="secondary" size="sm">Vendre</Button>
                                                    </SellSharesDialog>
                                                </>
                                            ) : (
                                                <>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/trading/${holding.asset!.ticker}`}>Détails</Link>
                                                    </Button>
                                                    {holding.asset ? (
                                                        <TradeDialog asset={holding.asset as AssetFromDb} tradeType="Sell">
                                                            <Button variant="secondary" size="sm">Vendre</Button>
                                                        </TradeDialog>
                                                    ) : (
                                                        <Button variant="secondary" size="sm" disabled>Vendre</Button>
                                                    )}
                                                </>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        Vous ne possédez aucun actif pour le moment.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>

                    {/* Mobile: stacked cards */}
                    <div className="space-y-3 md:hidden">
                        {holdingsWithMarketData.length > 0 ? (
                            holdingsWithMarketData.map(holding => (
                                <div key={`m-${holding.ticker}-${holding.isCompanyShare}`} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{holding.name}</div>
                                            <div className="text-sm text-muted-foreground">{holding.ticker}</div>
                                        </div>
                                        <div className={`text-right text-sm font-semibold ${holding.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            <div>{holding.pnl >= 0 ? '+' : '-'}${Math.abs(holding.pnl).toFixed(2)}</div>
                                            <div className="text-xs font-normal">({holding.pnlPercent.toFixed(2)}%)</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Quantité</div>
                                            <div>{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Prix</div>
                                            <div>${holding.currentPrice.toFixed(holding.currentPrice > 10 ? 2 : 4)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Valeur</div>
                                            <div>${holding.currentValue.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        {holding.isCompanyShare ? (
                                            <>
                                                <Button asChild variant="outline" size="sm" className="flex-1">
                                                    <Link href={`/companies/${holding.id}`}>Détails</Link>
                                                </Button>
                                                <SellSharesDialog
                                                    companyId={holding.id}
                                                    companyName={holding.name}
                                                    sharePrice={holding.currentPrice}
                                                    sharesHeld={holding.quantity}
                                                    isListed={holding.company?.isListed}
                                                >
                                                    <Button variant="secondary" size="sm" className="flex-1">Vendre</Button>
                                                </SellSharesDialog>
                                            </>
                                        ) : (
                                            <>
                                                <Button asChild variant="outline" size="sm" className="flex-1">
                                                    <Link href={`/trading/${holding.asset!.ticker}`}>Détails</Link>
                                                </Button>
                                                {holding.asset ? (
                                                    <TradeDialog asset={holding.asset as AssetFromDb} tradeType="Sell">
                                                        <Button variant="secondary" size="sm" className="flex-1">Vendre</Button>
                                                    </TradeDialog>
                                                ) : (
                                                    <Button variant="secondary" size="sm" className="flex-1" disabled>Vendre</Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex h-24 items-center justify-center text-center text-muted-foreground">
                                Vous ne possédez aucun actif pour le moment.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
