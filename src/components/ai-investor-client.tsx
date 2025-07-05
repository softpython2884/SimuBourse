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
  newsArticle: z.string().min(50, { message: 'News article must be at least 50 characters long.' }),
  portfolio: z.string().min(3, { message: 'Please describe your portfolio (e.g., "AAPL, GOOG, cash").' }),
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
      setError('An error occurred while analyzing the article. Please try again.');
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
                <FormLabel>News Article</FormLabel>
                <FormControl>
                  <Textarea placeholder="Paste a financial news article here..." className="min-h-[150px]" {...field} />
                </FormControl>
                <FormDescription>
                  The AI will analyze the sentiment and key points of the article.
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
                  <FormLabel>Your Portfolio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 50% TSLA, 30% BTC, 20% cash" {...field} />
                  </FormControl>
                   <FormDescription>
                    Provide a brief overview of your current holdings.
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
                  <FormLabel>Risk Preference</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your risk tolerance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                   <FormDescription>
                    This will tailor the investment suggestions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" disabled={isLoading} size="lg">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Analyze & Recommend
          </Button>
        </form>
      </Form>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>AI Analysis & Recommendations</CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead className="text-right">Risk Score (1-10)</TableHead>
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
