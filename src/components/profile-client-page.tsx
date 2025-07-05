'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { usePortfolio } from "@/context/portfolio-context";
import { useMemo } from "react";

// In a real app, this would come from a backend API
const marketPrices: { [ticker: string]: number } = {
  'AAPL': 207.69,
  'MSFT': 442.57,
  'AMZN': 183.63,
  'BTC': 67120.50,
  'ETH': 3450.78,
  'XAU': 2320.50,
  'EURUSD': 1.0712,
  'NVDA': 120.89,
  'TSLA': 177.46,
};


export default function ProfileClientPage() {
    const { user } = useAuth();
    const { transactions, cash, holdings, initialCash } = usePortfolio();

    const getInitials = (email: string | null) => {
        if (!email) return 'U';
        return email.charAt(0).toUpperCase();
    }
    
    const portfolioValue = useMemo(() => {
        const assetsValue = holdings.reduce((total, holding) => {
            const currentPrice = marketPrices[holding.ticker] || holding.avgCost;
            return total + (currentPrice * holding.quantity);
        }, 0);
        return cash + assetsValue;
    }, [cash, holdings]);

    const totalGains = portfolioValue - initialCash;
    const totalGainsPercentage = initialCash > 0 ? (totalGains / initialCash) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarFallback>{getInitials(user?.email || null)}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold">{user?.email}</h2>
            <p className="text-muted-foreground">Inscrit en Juillet 2024</p>
          </CardContent>
        </Card>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex justify-between">
              <span className="text-muted-foreground">Valeur Totale du Portefeuille</span>
              <span className="font-bold">${portfolioValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gains Totaux</span>
              <span className={`font-bold ${totalGains >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {totalGains >= 0 ? '+' : '-'}${Math.abs(totalGains).toFixed(2)} ({totalGainsPercentage.toFixed(2)}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taux de Victoire (Paris)</span>
              <span className="font-bold">N/A</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Historique des Transactions</CardTitle>
            <CardDescription>Un journal de toutes vos activités de trading récentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Actif/Détails</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Valeur</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((tx, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant={tx.type === 'Buy' ? 'default' : 'secondary'} className={tx.type === 'Buy' ? 'bg-red-600' : 'bg-green-600'}>
                          {tx.type === 'Buy' ? 'Achat' : 'Vente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{tx.asset.name} ({tx.asset.ticker})</TableCell>
                      <TableCell>{tx.quantity}</TableCell>
                      <TableCell>${tx.price.toFixed(2)}</TableCell>
                      <TableCell className={tx.type === 'Buy' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}>
                        {tx.type === 'Buy' ? '-' : '+'}${tx.value.toFixed(2)}
                      </TableCell>
                      <TableCell>{tx.date}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucune transaction pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
