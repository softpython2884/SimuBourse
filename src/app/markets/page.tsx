import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const markets = [
  {
    title: "US Presidential Election Winner",
    category: "Politics",
    outcomes: [
      { name: "Candidate A", odds: "55%" },
      { name: "Candidate B", odds: "45%" },
    ],
  },
  {
    title: "Will US Inflation be below 3% in Q4?",
    category: "Economics",
    outcomes: [
      { name: "Yes", odds: "65%" },
      { name: "No", odds: "35%" },
    ],
  },
  {
    title: "World Cup 2026 Winner",
    category: "Sports",
    outcomes: [
      { name: "Brazil", odds: "20%" },
      { name: "France", odds: "18%" },
      { name: "Argentina", odds: "15%" },
      { name: "Other", odds: "47%" },
    ],
  },
];

export default function PredictionMarketsPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div className="lg:col-span-3">
        <h1 className="text-2xl font-bold tracking-tight">Prediction Markets</h1>
        <p className="text-muted-foreground">Bet on the outcome of real-world events.</p>
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
            <Button className="w-full">Place Bet</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
