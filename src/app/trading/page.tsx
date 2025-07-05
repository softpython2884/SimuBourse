'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeDialog } from "@/components/trade-dialog";
import { useMarketData } from '@/context/market-data-context';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function TradingPage() {
  const { assets, loading } = useMarketData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('marketCap_desc');

  const filteredAndSortedAssets = useMemo(() => {
    let processedAssets = [...assets];

    const parseMarketCap = (mc: string): number => {
        if (!mc || typeof mc !== 'string') return 0;
        const value = parseFloat(mc.replace(/[^0-9.]/g, ''));
        if (mc.includes('T')) return value * 1e12;
        if (mc.includes('B')) return value * 1e9;
        if (mc.includes('M')) return value * 1e6;
        return value;
    };

    processedAssets.sort((a, b) => {
        switch (sortOption) {
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'name_desc': return b.name.localeCompare(a.name);
            case 'price_asc': return a.price - b.price;
            case 'price_desc': return b.price - a.price;
            case 'marketCap_asc': return parseMarketCap(a.marketCap) - parseMarketCap(b.marketCap);
            case 'marketCap_desc': return parseMarketCap(b.marketCap) - parseMarketCap(a.marketCap);
            case 'change_asc': return parseFloat(a.change24h) - parseFloat(b.change24h);
            case 'change_desc': return parseFloat(b.change24h) - parseFloat(a.change24h);
            default: return parseMarketCap(b.marketCap) - parseMarketCap(a.marketCap);
        }
    });

    if (searchTerm) {
        processedAssets = processedAssets.filter(asset =>
            asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            asset.ticker.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    return processedAssets;
  }, [assets, searchTerm, sortOption]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle>Salle des Marchés</CardTitle>
                <CardDescription>Achetez et vendez des actifs en utilisant les données du marché en temps réel.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Rechercher (ex: AAPL)..."
                        className="w-full sm:w-[200px] lg:w-[250px] pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={sortOption} onValueChange={setSortOption}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="marketCap_desc">Cap. Boursière (Décroissant)</SelectItem>
                        <SelectItem value="marketCap_asc">Cap. Boursière (Croissant)</SelectItem>
                        <SelectItem value="name_asc">Nom (A-Z)</SelectItem>
                        <SelectItem value="name_desc">Nom (Z-A)</SelectItem>
                        <SelectItem value="price_desc">Prix (Décroissant)</SelectItem>
                        <SelectItem value="price_asc">Prix (Croissant)</SelectItem>
                        <SelectItem value="change_desc">Variation (Décroissant)</SelectItem>
                        <SelectItem value="change_asc">Variation (Croissant)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
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
            {filteredAndSortedAssets.map((asset) => {
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
