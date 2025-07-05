'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeDialog } from "@/components/trade-dialog";
import type { Asset } from "@/context/portfolio-context";

// Note: In a real app, this data would come from an API.
const assets: Asset[] = [
    { name: 'Apple Inc.', ticker: 'AAPL', price: 207.69, type: 'Stock' },
    { name: 'Microsoft Corp.', ticker: 'MSFT', price: 442.57, type: 'Stock' },
    { name: 'Amazon.com, Inc.', ticker: 'AMZN', price: 183.63, type: 'Stock' },
    { name: 'Bitcoin', ticker: 'BTC', price: 67120.50, type: 'Crypto' },
    { name: 'Ethereum', ticker: 'ETH', price: 3450.78, type: 'Crypto' },
    { name: 'Gold Spot', ticker: 'XAU', price: 2320.50, type: 'Commodity' },
    { name: 'EUR/USD', ticker: 'EURUSD', price: 1.0712, type: 'Forex' },
    { name: 'NVIDIA Corporation', ticker: 'NVDA', price: 120.89, type: 'Stock' },
    { name: 'Tesla, Inc.', ticker: 'TSLA', price: 177.46, type: 'Stock' },
  ];

  const staticData = [
    { ticker: 'AAPL', change: '+1.24%', marketCap: '$3.18T' },
    { ticker: 'MSFT', change: '+0.92%', marketCap: '$3.29T' },
    { ticker: 'AMZN', change: '-0.10%', marketCap: '$1.91T' },
    { ticker: 'BTC', change: '+2.10%', marketCap: '$1.32T' },
    { ticker: 'ETH', change: '-1.50%', marketCap: '$414.5B' },
    { ticker: 'XAU', change: '+0.50%', marketCap: '$15.8T' },
    { ticker: 'EURUSD', change: '-0.21%', marketCap: 'N/A' },
    { ticker: 'NVDA', change: '+8.97%', marketCap: '$2.97T' },
    { ticker: 'TSLA', change: '+5.42%', marketCap: '$565.4B' },
  ]


export default function TradingPage() {

  const getAssetStaticData = (ticker: string) => {
    return staticData.find(d => d.ticker === ticker) || { change: 'N/A', marketCap: 'N/A' };
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
              const extraData = getAssetStaticData(asset.ticker);
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
                <TableCell className={extraData.change.startsWith('+') ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {extraData.change}
                </TableCell>
                <TableCell>{extraData.marketCap}</TableCell>
                <TableCell className="text-right space-x-2">
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
