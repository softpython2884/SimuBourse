'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { recommendInvestments, RecommendInvestmentsOutput } from '@/ai/flows/recommend-investments';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  newsArticle: z.string().min(50, { message: 'L\'article de presse doit contenir au moins 50 caractères.' }),
  portfolio: z.string().min(3, { message: 'Veuillez décrire votre portefeuille (par ex., "AAPL, GOOG, cash").' }),
  riskPreferences: z.enum(['low', 'medium', 'high']),
});

export function AIInvestorClient() {
  const [result, setResult] = useState<RecommendInvestmentsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newsArticle: '',
      portfolio: '',
      riskPreferences: 'medium',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await recommendInvestments(values);
      setResult(response);
    } catch (e) {
      console.error(e);
      setError('Une erreur est survenue lors de l\'analyse de l\'article. Veuillez réessayer.');
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="newsArticle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Article de Presse</FormLabel>
                <FormControl>
                  <Textarea placeholder="Collez un article de presse financier ici..." className="min-h-[150px]" {...field} />
                </FormControl>
                <FormDescription>
                  L'IA analysera le sentiment et les points clés de l'article.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="portfolio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votre Portefeuille</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ex: 50% TSLA, 30% BTC, 20% cash" {...field} />
                  </FormControl>
                   <FormDescription>
                    Fournissez un bref aperçu de vos avoirs actuels.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="riskPreferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Préférence de Risque</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre tolérance au risque" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Risque Faible</SelectItem>
                      <SelectItem value="medium">Risque Moyen</SelectItem>
                      <SelectItem value="high">Risque Élevé</SelectItem>
                    </SelectContent>
                  </Select>
                   <FormDescription>
                    Cela adaptera les suggestions d'investissement.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" disabled={isLoading} size="lg">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyser & Recommander
          </Button>
        </form>
      </Form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Analyse & Recommandations de l'IA</CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Raisonnement</TableHead>
                  <TableHead className="text-right">Score de Risque (1-10)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.recommendations.map((rec, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{rec.ticker}</TableCell>
                    <TableCell>{rec.reason}</TableCell>
                    <TableCell className="text-right font-mono">{rec.riskScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
