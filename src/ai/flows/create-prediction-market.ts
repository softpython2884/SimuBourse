'use server';
/**
 * @fileOverview Creates a plausible prediction market.
 *
 * - createPredictionMarket - A function that generates a prediction market.
 * - CreatePredictionMarketInput - The input type for the function.
 * - CreatePredictionMarketOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CreatePredictionMarketInputSchema = z.object({
  theme: z.string().describe('The general theme for the market, e.g., "stock market", "tech innovations", "world events".'),
});
export type CreatePredictionMarketInput = z.infer<typeof CreatePredictionMarketInputSchema>;

const CreatePredictionMarketOutputSchema = z.object({
      title: z.string().describe("A clear, concise, and answerable question for a prediction market. It should be about a future event. Example: 'Will BTC cross $80,000 before August 2024?'"),
      category: z.string().describe("A single, relevant category for the market. Example: 'Crypto', 'Tech', 'Geopolitics'."),
      outcomes: z.array(z.string().describe("A list of 2 to 4 mutually exclusive outcomes. Example: ['Yes', 'No'] or ['Tesla', 'Ford', 'GM']")).min(2).max(4).describe("A list of possible outcomes for the market question."),
});
export type CreatePredictionMarketOutput = z.infer<typeof CreatePredictionMarketOutputSchema>;

export async function createPredictionMarket(input: CreatePredictionMarketInput): Promise<CreatePredictionMarketOutput> {
    return createPredictionMarketFlow(input);
}

const prompt = ai.definePrompt({
    name: 'createPredictionMarketPrompt',
    input: {schema: CreatePredictionMarketInputSchema},
    output: {schema: CreatePredictionMarketOutputSchema},
    prompt: `You are an AI that creates interesting and plausible prediction markets for a financial simulation game.
The market should be a clear question about a future event.
The outcomes must be mutually exclusive.
The theme is: {{theme}}.
Generate a single prediction market based on this theme.
`,
});

const createPredictionMarketFlow = ai.defineFlow(
    {
        name: 'createPredictionMarketFlow',
        inputSchema: CreatePredictionMarketInputSchema,
        outputSchema: CreatePredictionMarketOutputSchema,
    },
    async (input) => {
        const {output} = await prompt(input);
        return output!;
    }
);
