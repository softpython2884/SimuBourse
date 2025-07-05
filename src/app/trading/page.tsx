'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeDialog } from "@/components/trade-dialog";
import { useMarketData } from '@/context/market-data-context';
import { Loader2 } from 'lucide-react';


export default function TradingPage() {
  const { assets, loading } = useMarketData();

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salle des Marchés</CardTitle>
        <CardDescription>Achetez et vendez des actifs en utilisant les données du marché en temps réel.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actif</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Variation (24h)</TableHead>
              <TableHead>Cap. Boursière</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => {
              const changeIsPositive = asset.change24h.startsWith('+');
              return (
              <TableRow key={asset.ticker}>
                <TableCell>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-sm text-muted-foreground">{asset.ticker}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{asset.type}</Badge>
                </TableCell>
                <TableCell className="font-mono">${asset.price.toFixed(2)}</TableCell>
                <TableCell className={changeIsPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {asset.change24h}
                </TableCell>
                <TableCell>{asset.marketCap}</TableCell>
                <TableCell className="text-right space-x-2">
                   <Button asChild variant="outline" size="sm">
                    <Link href={`/trading/${asset.ticker}`}>Détails</Link>
                   </Button>
                   <TradeDialog asset={asset} tradeType="Buy">
                    <Button variant="outline" size="sm">Acheter</Button>
                  </TradeDialog>
                  <TradeDialog asset={asset} tradeType="Sell">
                    <Button variant="secondary" size="sm">Vendre</Button>
                  </TradeDialog>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
