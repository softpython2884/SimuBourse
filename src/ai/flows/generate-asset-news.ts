'use server';
/**
 * @fileOverview Generates a plausible news snippet for a given financial asset.
 *
 * - generateAssetNews - A function that generates a news headline and article.
 * - GenerateAssetNewsInput - The input type for the function.
 * - GenerateAssetNewsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateAssetNewsInputSchema = z.object({
  ticker: z.string().describe('The stock ticker of the asset.'),
  name: z.string().describe('The name of the company or asset.'),
});
export type GenerateAssetNewsInput = z.infer<typeof GenerateAssetNewsInputSchema>;

export const GenerateAssetNewsOutputSchema = z.object({
  headline: z.string().describe('A plausible, short news headline (less than 15 words).'),
  article: z.string().describe('A brief, 2-3 sentence news article expanding on the headline.'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('The overall sentiment of the news regarding the asset.'),
});
export type GenerateAssetNewsOutput = z.infer<typeof GenerateAssetNewsOutputSchema>;

export async function generateAssetNews(input: GenerateAssetNewsInput): Promise<GenerateAssetNewsOutput> {
    return generateAssetNewsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateAssetNewsPrompt',
    input: {schema: GenerateAssetNewsInputSchema},
    output: {schema: GenerateAssetNewsOutputSchema},
    prompt: `You are a financial news generator for a simulation game. Your task is to create a short, plausible, and impactful news event for a specific company. The news should feel realistic.

Generate a news item for the following asset:
Company Name: {{name}}
Ticker: {{ticker}}

The news can be positive (e.g., breakthrough product, beating earnings expectations), negative (e.g., product recall, regulatory fines, missed targets), or neutral (e.g., analyst rating update).

Create a concise headline, a brief article (2-3 sentences), and determine the sentiment.
Output in JSON format.`,
});

const generateAssetNewsFlow = ai.defineFlow(
    {
        name: 'generateAssetNewsFlow',
        inputSchema: GenerateAssetNewsInputSchema,
        outputSchema: GenerateAssetNewsOutputSchema,
    },
    async (input) => {
        const {output} = await prompt(input);
        return output!;
    }
);
