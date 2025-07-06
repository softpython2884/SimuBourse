'use server';
/**
 * @fileOverview Generates plausible news snippets for a given financial asset.
 *
 * - generateAssetNews - A function that generates news headlines and articles.
 * - GenerateAssetNewsInput - The input type for the function.
 * - GenerateAssetNewsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAssetNewsInputSchema = z.object({
  ticker: z.string().describe('The stock ticker of the asset.'),
  name: z.string().describe('The name of the company or asset.'),
});
export type GenerateAssetNewsInput = z.infer<typeof GenerateAssetNewsInputSchema>;

const NewsItemSchema = z.object({
  headline: z.string().describe('A plausible, short news headline (less than 15 words).'),
  article: z.string().describe('A brief, 2-3 sentence news article expanding on the headline.'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('The overall sentiment of the news regarding the asset.'),
  impactScore: z.number().int().min(-10).max(10).describe('An integer from -10 to +10 representing the news\'s market impact. -10 is a catastrophic event (e.g., bankruptcy). +10 is a massive breakthrough (e.g., revolutionary tech). 0 is neutral.'),
});

const GenerateAssetNewsOutputSchema = z.array(NewsItemSchema);
export type GenerateAssetNewsOutput = z.infer<typeof GenerateAssetNewsOutputSchema>;

export async function generateAssetNews(input: GenerateAssetNewsInput): Promise<GenerateAssetNewsOutput> {
    return generateAssetNewsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateAssetNewsPrompt',
    input: {schema: GenerateAssetNewsInputSchema},
    output: {schema: GenerateAssetNewsOutputSchema},
    prompt: `You are a financial news generator for a simulation game. Your task is to create 3 short, plausible, and impactful news events for a specific company. The news should feel realistic.

Generate 3 distinct news items for the following asset:
Company Name: {{name}}
Ticker: {{ticker}}

The news can be positive (e.g., breakthrough product, beating earnings expectations), negative (e.g., product recall, regulatory fines, missed targets), or neutral (e.g., analyst rating update).

For each news item, create a concise headline, a brief article (2-3 sentences), determine the sentiment, and provide an impactScore.
The impactScore is an integer from -10 to +10 representing the market impact.
- A score of -10 is a catastrophic event (e.g., bankruptcy filing, major fraud uncovered).
- A score of +10 is a massive positive event (e.g., revolutionary product launch, major government contract).
- A score of 0 is neutral news (e.g., minor analyst update).
- Scores like -2 or +3 represent everyday news (e.g., missed/beat earnings slightly).

Output in JSON format as an array of 3 objects.`,
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
