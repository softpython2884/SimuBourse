'use client';

import { useMemo } from 'react';
import { usePortfolio } from '@/context/portfolio-context';
import { useMarketData } from '@/context/market-data-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function PortfolioClientPage() {
    const { holdings, cash, initialCash } = usePortfolio();
    const { getAssetByTicker } = useMarketData();

    const holdingsWithMarketData = useMemo(() => {
        return holdings.map(holding => {
            const asset = getAssetByTicker(holding.ticker);
            const currentPrice = asset?.price || holding.avgCost;
            const currentValue = holding.quantity * currentPrice;
            const totalCost = holding.quantity * holding.avgCost;
            const pnl = currentValue - totalCost;
            const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
            return {
                ...holding,
                asset,
                currentPrice,
                currentValue,
                pnl,
                pnlPercent
            };
        }).sort((a, b) => b.currentValue - a.currentValue);
    }, [holdings, getAssetByTicker]);
    
    const assetsValue = useMemo(() => holdingsWithMarketData.reduce((sum, holding) => sum + holding.currentValue, 0), [holdingsWithMarketData]);
    const portfolioValue = assetsValue + cash;
    const totalPortfolioPnL = portfolioValue - initialCash;
    const totalPortfolioPnLPercent = initialCash > 0 ? (totalPortfolioPnL / initialCash) * 100 : 0;

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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Actif</TableHead>
                                <TableHead>Quantité</TableHead>
                                <TableHead>Coût Moyen</TableHead>
                                <TableHead>Prix Actuel</TableHead>
                                <TableHead>Valeur Actuelle</TableHead>
                                <TableHead className="text-right">Gains/Pertes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {holdingsWithMarketData.length > 0 ? (
                                holdingsWithMarketData.map(holding => (
                                    <TableRow key={holding.ticker}>
                                        <TableCell>
                                            <div className="font-medium">{holding.name}</div>
                                            <div className="text-sm text-muted-foreground">{holding.ticker}</div>
                                        </TableCell>
                                        <TableCell>{holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 5 })}</TableCell>
                                        <TableCell>${holding.avgCost.toFixed(2)}</TableCell>
                                        <TableCell>${holding.currentPrice.toFixed(2)}</TableCell>
                                        <TableCell>${holding.currentValue.toFixed(2)}</TableCell>
                                        <TableCell className={`text-right font-medium ${holding.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            <div>{holding.pnl >= 0 ? '+' : '-'}${Math.abs(holding.pnl).toFixed(2)}</div>
                                            <div className="text-xs">({holding.pnlPercent.toFixed(2)}%)</div>
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
                </CardContent>
            </Card>
        </div>
    );
}
