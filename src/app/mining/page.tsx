import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cpu, Zap, Gem } from "lucide-react";

const hardware = [
  {
    name: "Starter GPU Rig",
    hashRate: "150 MH/s",
    power: "600W",
    price: "$2,500",
  },
  {
    name: "Advanced ASIC Miner",
    hashRate: "110 TH/s",
    power: "3250W",
    price: "$12,000",
  },
  {
    name: "Pro Mining Farm (Share)",
    hashRate: "5 PH/s",
    power: "N/A (Managed)",
    price: "$50,000",
  },
];

export default function MiningPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Crypto Mining</h1>
        <p className="text-muted-foreground">Purchase hardware and earn crypto rewards based on your total mining power.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {hardware.map((item, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Cpu className="h-4 w-4" /> Hash Rate</span>
                <span className="font-semibold">{item.hashRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="h-4 w-4" /> Power</span>
                <span className="font-semibold">{item.power}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><Gem className="h-4 w-4" /> Price</span>
                <span className="font-semibold text-primary">{item.price}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Purchase Hardware</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
