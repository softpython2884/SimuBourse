'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMarketData } from '@/context/market-data-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TradeDialog } from '@/components/trade-dialog';
import { AssetChartClient } from '@/components/asset-chart-client';
import { Badge } from '@/components/ui/badge';

export default function AssetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticker = params.ticker as string;
  
  const { getAssetByTicker, loading } = useMarketData();
  const asset = getAssetByTicker(ticker);

  if (loading && !asset) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Actif non trouvé</h2>
        <p className="text-muted-foreground">L'actif avec le ticker "{ticker}" n'existe pas.</p>
        <Button onClick={() => router.push('/trading')} className="mt-4">
          Retour à la Salle des Marchés
        </Button>
      </div>
    );
  }

  const changeIsPositive = asset.change24h?.startsWith('+');

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Retour</span>
        </Button>
        <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
          {asset.name} ({asset.ticker})
        </h1>
        <Badge variant="outline" className="ml-auto sm:ml-0">{asset.type}</Badge>
        <div className="hidden items-center gap-2 md:ml-auto md:flex">
          <TradeDialog asset={asset} tradeType="Buy">
            <Button>Acheter</Button>
          </TradeDialog>
          <TradeDialog asset={asset} tradeType="Sell">
            <Button variant="secondary">Vendre</Button>
          </TradeDialog>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${asset.price.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variation (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${changeIsPositive ? 'text-green-500' : 'text-red-500'}`}>
                {asset.change24h}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cap. Boursière</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{asset.marketCap}</div>
          </CardContent>
        </Card>
      </div>
      <AssetChartClient asset={asset} />
      <Card>
        <CardHeader>
            <CardTitle>À propos de {asset.name}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">{asset.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
