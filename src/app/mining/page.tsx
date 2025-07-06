'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Zap, Gem, Loader2, Server, Coins, Network } from "lucide-react";
import { MINING_RIGS } from '@/lib/mining';
import { usePortfolio } from '@/context/portfolio-context';
import { useMarketData } from '@/context/market-data-context';
import { buyMiningRig } from '@/lib/actions/mining';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function MiningPage() {
    const { userProfile, loading: portfolioLoading, unclaimedRewards, totalHashRateMhs } = usePortfolio();
    const { getAssetByTicker } = useMarketData();
    const { toast } = useToast();
    const [isBuying, setIsBuying] = useState<string | null>(null);

    const btcPrice = getAssetByTicker('BTC')?.price || 0;

    const ownedRigs = useMemo(() => {
        return userProfile?.miningRigs.map(ownedRig => {
            const rigData = MINING_RIGS.find(r => r.id === ownedRig.rigId);
            return {
                ...rigData,
                quantity: ownedRig.quantity,
            }
        }).filter(r => r && r.id);
    }, [userProfile?.miningRigs]);

    const estimatedDailyBtc = useMemo(() => {
        if (totalHashRateMhs === 0) return 0;
        const BTC_PER_MHS_PER_SECOND = 7.7e-12;
        return totalHashRateMhs * BTC_PER_MHS_PER_SECOND * 86400; // 86400 seconds in a day
    }, [totalHashRateMhs]);

    const handleBuyRig = async (rigId: string) => {
        setIsBuying(rigId);
        const result = await buyMiningRig(rigId);
        if (result.error) {
            toast({ variant: 'destructive', title: "Échec de l'achat", description: result.error });
        }
        if (result.success) {
            toast({ title: "Achat réussi", description: result.success });
        }
        setIsBuying(null);
    }
    
    const formatHashRate = (mhs: number) => {
        if (mhs >= 1_000_000) return `${(mhs / 1_000_000).toFixed(2)} TH/s`;
        if (mhs >= 1_000) return `${(mhs / 1_000).toFixed(2)} GH/s`;
        return `${mhs.toFixed(0)} MH/s`;
    }

    if (portfolioLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

  return (
    <div className="space-y-6">
        <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Minage de Crypto</h1>
            <p className="text-muted-foreground">Achetez du matériel et gagnez des récompenses en crypto en fonction de votre puissance de minage totale.</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Votre Opération de Minage</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
                 <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Network className="h-4 w-4" /> Puissance de Hachage Totale</span>
                    <span className="text-2xl font-bold">{formatHashRate(totalHashRateMhs)}</span>
                </div>
                 <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Coins className="h-4 w-4" /> Revenu Estimé (24h)</span>
                    <span className="text-2xl font-bold">{estimatedDailyBtc.toFixed(6)} BTC</span>
                     <p className="text-xs text-muted-foreground">
                      ≈ ${(estimatedDailyBtc * btcPrice).toFixed(2)}
                    </p>
                </div>
                 <div className="flex flex-col space-y-1.5 rounded-lg border p-4">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><Gem className="h-4 w-4" /> Récompenses non réclamées</span>
                    <span className="text-2xl font-bold text-primary">{unclaimedRewards.toFixed(8)} BTC</span>
                    <p className="text-xs text-muted-foreground">
                      Réclamées automatiquement toutes les 30s
                    </p>
                </div>
            </CardContent>
        </Card>
        
        {ownedRigs && ownedRigs.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Mon Matériel</CardTitle></CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {ownedRigs.map((rig, index) => (
                         <Alert key={index}>
                            <Server className="h-4 w-4" />
                            <AlertTitle>{rig.name}</AlertTitle>
                            <AlertDescription>
                                Quantité: {rig.quantity} • Puissance: {formatHashRate(rig.hashRateMhs! * rig.quantity)}
                            </AlertDescription>
                        </Alert>
                    ))}
                </CardContent>
            </Card>
        )}

      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Acheter du Matériel</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {MINING_RIGS.map((item) => (
            <Card key={item.id} className="flex flex-col">
                <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow">
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Cpu className="h-4 w-4" /> Taux de Hashage</span>
                    <span className="font-semibold">{formatHashRate(item.hashRateMhs)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4" /> Puissance</span>
                    <span className="font-semibold">{item.power}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground"><Gem className="h-4 w-4" /> Prix</span>
                    <span className="font-semibold text-primary">${item.price.toLocaleString()}</span>
                </div>
                </CardContent>
                <CardFooter>
                <Button className="w-full" onClick={() => handleBuyRig(item.id)} disabled={isBuying !== null}>
                    {isBuying === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Acheter le Matériel
                </Button>
                </CardFooter>
            </Card>
            ))}
        </div>
      </div>
    </div>
  );
}