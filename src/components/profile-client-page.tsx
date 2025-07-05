'use client';

import { useMemo, useEffect } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePortfolio } from "@/context/portfolio-context";
import { useMarketData } from "@/context/market-data-context";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileFormSchema = z.object({
  displayName: z.string().min(3, { message: "Le nom d'utilisateur doit comporter au moins 3 caractères." }),
  phoneNumber: z.string().optional(),
});


export default function ProfileClientPage() {
    const { userProfile, updateUserProfile, transactions, cash, holdings, initialCash } = usePortfolio();
    const { getAssetByTicker } = useMarketData();

    const form = useForm<z.infer<typeof profileFormSchema>>({
      resolver: zodResolver(profileFormSchema),
      values: { 
        displayName: userProfile?.displayName || '',
        phoneNumber: userProfile?.phoneNumber || '',
      },
    });

    const getInitials = (displayName: string | undefined) => {
        if (!displayName) return 'U';
        return displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
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
                pnlPercent,
                isRealized: false,
            };
        }).sort((a, b) => b.currentValue - a.currentValue);
    }, [holdings, getAssetByTicker]);
    
    const realizedPnL = useMemo(() => {
        const transactionMap: { [key: string]: { buys: number, sells: number, name: string } } = {};

        transactions.forEach(tx => {
            if (!transactionMap[tx.asset.ticker]) {
                transactionMap[tx.asset.ticker] = { buys: 0, sells: 0, name: tx.asset.name };
            }
            if (tx.type === 'Buy') {
                transactionMap[tx.asset.ticker].buys += tx.value;
            } else {
                transactionMap[tx.asset.ticker].sells += tx.value;
            }
        });

        const holdingTickers = new Set(holdings.map(h => h.ticker));

        return Object.keys(transactionMap)
            .filter(ticker => !holdingTickers.has(ticker) && transactionMap[ticker].sells > 0)
            .map(ticker => {
                const pnl = transactionMap[ticker].sells - transactionMap[ticker].buys;
                const costBasis = transactionMap[ticker].buys;
                return {
                    ticker,
                    name: transactionMap[ticker].name,
                    quantity: 0,
                    currentValue: 0,
                    pnl,
                    pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
                    isRealized: true,
                };
            });
    }, [transactions, holdings]);

    const allAssetsPerformance = useMemo(() => {
        return [...holdingsWithMarketData, ...realizedPnL].sort((a,b) => {
            if (a.isRealized && !b.isRealized) return 1;
            if (!a.isRealized && b.isRealized) return -1;
            return (b.currentValue || b.pnl) - (a.currentValue || a.pnl);
        });
    }, [holdingsWithMarketData, realizedPnL]);

    const portfolioValue = useMemo(() => {
        const assetsValue = holdingsWithMarketData.reduce((total, holding) => total + holding.currentValue, 0);
        return cash + assetsValue;
    }, [cash, holdingsWithMarketData]);

    const totalGains = portfolioValue - initialCash;
    const totalGainsPercentage = initialCash > 0 ? (totalGains / initialCash) * 100 : 0;

    async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
      await updateUserProfile(values);
    }

  return (
    <Tabs defaultValue="overview">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="overview">Aperçu</TabsTrigger>
        <TabsTrigger value="settings">Paramètres & Sécurité</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                      Profil
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarFallback>{getInitials(userProfile?.displayName)}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold">{userProfile?.displayName}</h2>
                  <p className="text-muted-foreground">{userProfile?.email}</p>
                  <p className="text-muted-foreground">{userProfile?.phoneNumber}</p>
                </CardContent>
              </Card>

              <Card>
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

            <div className="md:col-span-2 space-y-6">
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

               <Card>
                <CardHeader>
                  <CardTitle>Gains & Pertes par Actif</CardTitle>
                  <CardDescription>Performance de vos actifs actuels et passés.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Actif</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Valeur Actuelle</TableHead>
                        <TableHead>Gains/Pertes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allAssetsPerformance.length > 0 ? (
                        allAssetsPerformance.map(holding => (
                          <TableRow key={holding.ticker} className={holding.isRealized ? "opacity-60" : ""}>
                            <TableCell>
                              <div className="font-medium">{holding.name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                {holding.ticker}
                                {holding.isRealized && <Badge variant="outline">Vendu</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>{holding.quantity > 0 ? holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 5 }) : '-'}</TableCell>
                            <TableCell>${holding.currentValue > 0 ? holding.currentValue.toFixed(2) : '0.00'}</TableCell>
                            <TableCell className={`font-medium ${holding.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              <div>{holding.pnl >= 0 ? '+' : '-'}${Math.abs(holding.pnl).toFixed(2)}</div>
                              <div className="text-xs">({holding.pnlPercent.toFixed(2)}%)</div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                            Vous n'avez aucun historique d'actifs.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </div>
          </div>
      </TabsContent>

      <TabsContent value="settings">
          <Card>
              <CardHeader>
                  <CardTitle>Modifier le Profil</CardTitle>
              </CardHeader>
              <CardContent>
                  <Form {...form}>
                      <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
                          <FormField
                              control={form.control}
                              name="displayName"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Nom d'utilisateur</FormLabel>
                                      <FormControl>
                                          <Input placeholder="Votre nom" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={form.control}
                              name="phoneNumber"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Numéro de téléphone</FormLabel>
                                      <FormControl>
                                          <Input placeholder="+33 6 12 34 56 78" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <Button type="submit" disabled={form.formState.isSubmitting}>
                              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Enregistrer les modifications
                          </Button>
                      </form>
                  </Form>
              </CardContent>
          </Card>
      </TabsContent>
    </Tabs>
  );
}
