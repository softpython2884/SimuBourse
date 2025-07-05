import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const markets = [
  {
    title: "Vainqueur de l'élection présidentielle américaine",
    category: "Politique",
    outcomes: [
      { name: "Candidat A", odds: "55%" },
      { name: "Candidat B", odds: "45%" },
    ],
  },
  {
    title: "L'inflation américaine sera-t-elle inférieure à 3% au T4?",
    category: "Économie",
    outcomes: [
      { name: "Oui", odds: "65%" },
      { name: "Non", odds: "35%" },
    ],
  },
  {
    title: "Vainqueur de la Coupe du Monde 2026",
    category: "Sports",
    outcomes: [
      { name: "Brésil", odds: "20%" },
      { name: "France", odds: "18%" },
      { name: "Argentine", odds: "15%" },
      { name: "Autre", odds: "47%" },
    ],
  },
];

export default function PredictionMarketsPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="lg:col-span-3">
        <h1 className="text-2xl font-bold tracking-tight">Marché des Paris</h1>
        <p className="text-muted-foreground">Pariez sur le résultat d'événements du monde réel.</p>
      </div>
      {markets.map((market, index) => (
        <Card key={index} className="flex flex-col">
          <CardHeader>
            <CardTitle>{market.title}</CardTitle>
            <CardDescription>{market.category}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            {market.outcomes.map((outcome, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{outcome.name}</span>
                  <span className="font-semibold">{outcome.odds}</span>
                </div>
                <Progress value={parseInt(outcome.odds)} />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button className="w-full">Placer un Pari</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
