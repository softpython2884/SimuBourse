import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Zap, Gem } from "lucide-react";

const hardware = [
  {
    name: "Plateforme GPU de démarrage",
    hashRate: "150 MH/s",
    power: "600W",
    price: "$2,500",
  },
  {
    name: "Mineur ASIC avancé",
    hashRate: "110 TH/s",
    power: "3250W",
    price: "$12,000",
  },
  {
    name: "Part de Ferme de Minage Pro",
    hashRate: "5 PH/s",
    power: "N/A (Géré)",
    price: "$50,000",
  },
];

export default function MiningPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Minage de Crypto</h1>
        <p className="text-muted-foreground">Achetez du matériel et gagnez des récompenses en crypto en fonction de votre puissance de minage totale.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hardware.map((item, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Cpu className="h-4 w-4" /> Taux de Hashage</span>
                <span className="font-semibold">{item.hashRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4" /> Puissance</span>
                <span className="font-semibold">{item.power}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Gem className="h-4 w-4" /> Prix</span>
                <span className="font-semibold text-primary">{item.price}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Acheter le Matériel</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
