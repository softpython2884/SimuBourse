'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, Wallet, Bitcoin, TrendingUp, Trophy } from "lucide-react"
import Link from "next/link"
import { usePortfolio } from '@/context/portfolio-context';
import { useMarketData } from '@/context/market-data-context';

export default function Home() {
  const { cash, holdings, transactions, initialCash } = usePortfolio();
  const { assets: marketAssets, getAssetByTicker } = useMarketData();

  const portfolioValue = useMemo(() => {
    const assetsValue = holdings.reduce((total, holding) => {
        const currentPrice = getAssetByTicker(holding.ticker)?.price || holding.avgCost;
        return total + (currentPrice * holding.quantity);
    }, 0);
    return cash + assetsValue;
  }, [cash, holdings, getAssetByTicker]);

  const portfolioChange = useMemo(() => {
    if (initialCash === 0) return 0;
    const change = portfolioValue - initialCash;
    const percentage = (change / initialCash) * 100;
    return percentage;
  }, [portfolioValue, initialCash]);

  const btcHoldings = useMemo(() => {
    return holdings.find(h => h.ticker === 'BTC')?.quantity || 0;
  }, [holdings]);
  
  const btcPrice = getAssetByTicker('BTC')?.price || 0;

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5).map(tx => {
      return {
        description: `${tx.type === 'Buy' ? 'Achat' : 'Vente'} ${tx.quantity} ${tx.asset.ticker}`,
        details: tx.asset.name,
        amount: `${tx.type === 'Buy' ? '-' : '+'}$${tx.value.toFixed(2)}`
      }
    });
  }, [transactions]);

  const topMovers = useMemo(() => {
    return marketAssets
      .filter(a => ['TSLA', 'BTC', 'ETH', 'NVDA'].includes(a.ticker))
      .map(a => ({
          name: a.name,
          ticker: a.ticker,
          price: `$${a.price.toFixed(2)}`,
          change: a.change24h,
          marketCap: a.marketCap,
      }))
  }, [marketAssets]);


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valeur du Portefeuille
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioValue.toFixed(2)}</div>
            <p className={`text-xs ${portfolioChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {portfolioChange >= 0 ? '+' : ''}{portfolioChange.toFixed(2)}% depuis le début
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avoirs Crypto (BTC)
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{btcHoldings.toFixed(4)} BTC</div>
            <p className="text-xs text-muted-foreground">
              Valeur: ${(btcHoldings * btcPrice).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{transactions.length}</div>
            <p className="text-xs text-muted-foreground">
              Sur tous les marchés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gains (Marché des Paris)
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">
              Aucun pari effectué
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Top Mouvements</CardTitle>
              <CardDescription>
                Les actifs avec la plus forte variation de prix des dernières 24h.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/trading">
                Tout voir
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Variation (24h)</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Cap. Boursière</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMovers.map(mover => (
                  <TableRow key={mover.ticker}>
                    <TableCell>
                      <div className="font-medium">{mover.name}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {mover.ticker}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{mover.price}</TableCell>
                    <TableCell className={`hidden sm:table-cell text-right ${mover.change.startsWith('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{mover.change}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">{mover.marketCap}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions Récentes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, index) => (
              <div className="flex items-center gap-4" key={index}>
                <div className="grid gap-1">
                  <p className="text-sm font-medium leading-none">
                    {tx.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tx.details}
                  </p>
                </div>
                <div className={`ml-auto font-medium ${tx.amount.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>{tx.amount}</div>
              </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune transaction récente.</p>
            )
          }
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
