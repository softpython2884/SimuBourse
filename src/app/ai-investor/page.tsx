import { AIInvestorClient } from '@/components/ai-investor-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AIInvestorPage() {
  return (
    <div className="container mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Conseiller en Investissement IA</CardTitle>
          <CardDescription className="text-base">
            Analysez des articles de presse pour obtenir des recommandations d'investissement personnalisées par l'IA en fonction de votre portefeuille et de votre tolérance au risque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIInvestorClient />
        </CardContent>
      </Card>
    </div>
  );
}
