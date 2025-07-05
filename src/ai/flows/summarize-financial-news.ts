'use server';
/**
 * @fileOverview Summarizes financial news to help investors make informed decisions.
 *
 * - summarizeFinancialNews - A function that summarizes financial news.
 * - SummarizeFinancialNewsInput - The input type for the summarizeFinancialNews function.
 * - SummarizeFinancialNewsOutput - The return type for the summarizeFinancialNews function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFinancialNewsInputSchema = z.object({
  newsSummary: z
    .string()
    .describe('A comprehensive summary of financial news related to the user portfolio.'),
  portfolioTickers: z
    .array(z.string())
    .describe('The stock tickers in the user portfolio.'),
  potentialInvestmentTickers: z
    .array(z.string())
    .describe('The stock tickers the user is considering investing in.'),
});
export type SummarizeFinancialNewsInput = z.infer<
  typeof SummarizeFinancialNewsInputSchema
>;

const SummarizeFinancialNewsOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the financial news.'),
  investmentRecommendations: z
    .string()
    .describe('AI-driven investment recommendations based on the news.'),
});
export type SummarizeFinancialNewsOutput = z.infer<
  typeof SummarizeFinancialNewsOutputSchema
>;

export async function summarizeFinancialNews(
  input: SummarizeFinancialNewsInput
): Promise<SummarizeFinancialNewsOutput> {
  return summarizeFinancialNewsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeFinancialNewsPrompt',
  input: {schema: SummarizeFinancialNewsInputSchema},
  output: {schema: SummarizeFinancialNewsOutputSchema},
  prompt: `You are an AI investment advisor providing summaries and recommendations based on financial news.

  Here is a summary of recent financial news:
  {{newsSummary}}

  The user has the following stocks in their portfolio:
  {{#each portfolioTickers}}
    {{this}}
  {{/each}}

  The user is considering investing in the following stocks:
  {{#each potentialInvestmentTickers}}
    {{this}}
  {{/each}}

  Provide a concise summary of the news and give investment recommendations based on the news and the user's portfolio and potential investments.
`,
});

const summarizeFinancialNewsFlow = ai.defineFlow(
  {
    name: 'summarizeFinancialNewsFlow',
    inputSchema: SummarizeFinancialNewsInputSchema,
    outputSchema: SummarizeFinancialNewsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
