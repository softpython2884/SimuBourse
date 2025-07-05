import { AIInvestorClient } from '@/components/ai-investor-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AIInvestorPage() {
  return (
    <div className="container mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">AI Investment Advisor</CardTitle>
          <CardDescription className="text-base">
            Analyze news articles to get AI-powered investment recommendations tailored to your portfolio and risk tolerance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AIInvestorClient />
        </CardContent>
      </Card>
    </div>
  );
}
