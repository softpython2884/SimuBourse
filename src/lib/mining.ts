export interface MiningRig {
    id: string;
    name: string;
    hashRateMhs: number; // Hash rate in MH/s
    power: string;
    price: number;
    icon: any; // Lucide icon component
}

export const MINING_RIGS: MiningRig[] = [
  {
    id: "starter_gpu",
    name: "Plateforme GPU de démarrage",
    hashRateMhs: 150,
    power: "600W",
    price: 2500,
  },
  {
    id: "advanced_asic",
    name: "Mineur ASIC avancé",
    hashRateMhs: 110000, // 110 GH/s
    power: "3250W",
    price: 12000,
  },
  {
    id: "pro_farm_share",
    name: "Part de Ferme de Minage Pro",
    hashRateMhs: 5000000, // 5 TH/s
    power: "N/A (Géré)",
    price: 50000,
  },
];

export const getRigById = (id: string) => MINING_RIGS.find(rig => rig.id === id);