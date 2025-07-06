'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateMarketDialog } from '@/components/create-market-dialog';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface Market {
  id: string;
  title: string;
  category: string;
  outcomes: { name: string; pool: number }[];
  totalPool: number;
  creatorDisplayName: string;
  status: 'open' | 'closed' | 'settled';
  closingAt: Date;
  createdAt: Date;
}

export default function PredictionMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // La logique de récupération des données sera ré-implémentée avec PostgreSQL.
    // Pour l'instant, on affiche un état vide.
    setMarkets([]);
    setLoading(false);
  }, []);

  const getOdds = (pool: number, totalPool: number) => {
    if (totalPool === 0) return 0;
    return Math.round((pool / totalPool) * 100);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marché des Paris</h1>
          <p className="text-muted-foreground">Pariez sur le résultat d'événements du monde réel.</p>
        </div>
        <CreateMarketDialog />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : markets.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30">
            <p className="text-muted-foreground">Aucun marché ouvert pour le moment. La connexion à la base de données est en cours de migration.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <Card key={market.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{market.title}</CardTitle>
                <CardDescription>
                  Par {market.creatorDisplayName} • Ferme dans {formatDistanceToNow(market.closingAt, { locale: fr })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                {market.outcomes.map((outcome, i) => {
                  const odds = getOdds(outcome.pool, market.totalPool);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{outcome.name}</span>
                        <span className="font-semibold">{odds}%</span>
                      </div>
                      <Progress value={odds} />
                    </div>
                  )
                })}
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-2">
                 <div className="text-xs text-muted-foreground text-center">Pot Total : ${market.totalPool.toFixed(2)}</div>
                <Button className="w-full">Placer un Pari</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
