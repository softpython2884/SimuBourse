// Recommend investments based on news articles, user portfolio, and risk preferences.
'use server';

/**
 * @fileOverview An AI investment tool that analyzes news articles and suggests investment opportunities.
 *
 * - recommendInvestments - A function that handles the investment recommendation process.
 * - RecommendInvestmentsInput - The input type for the recommendInvestments function.
 * - RecommendInvestmentsOutput - The return type for the recommendInvestments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendInvestmentsInputSchema = z.object({
  newsArticle: z
    .string()
    .describe('A news article to analyze for investment opportunities.'),
  portfolio: z.string().describe('The user\'s current investment portfolio.'),
  riskPreferences: z
    .string()
    .describe('The user\'s risk preferences (e.g., low, medium, high).'),
});
export type RecommendInvestmentsInput = z.infer<typeof RecommendInvestmentsInputSchema>;

const RecommendationSchema = z.object({
  ticker: z.string().describe('The ticker symbol of the recommended investment.'),
  reason: z.string().describe('The reasoning behind the recommendation.'),
  riskScore: z.number().describe('The risk score associated with the recommendation.'),
});

const RecommendInvestmentsOutputSchema = z.object({
  recommendations: z.array(RecommendationSchema).describe('A list of investment recommendations.'),
  summary: z.string().describe('A summary of the analysis performed.'),
});
export type RecommendInvestmentsOutput = z.infer<typeof RecommendInvestmentsOutputSchema>;

export async function recommendInvestments(
  input: RecommendInvestmentsInput
): Promise<RecommendInvestmentsOutput> {
  return recommendInvestmentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendInvestmentsPrompt',
  input: {schema: RecommendInvestmentsInputSchema},
  output: {schema: RecommendInvestmentsOutputSchema},
  prompt: `You are an AI investment tool that analyzes news articles and suggests investment opportunities based on the user's portfolio and risk preferences.

Analyze the following news article:
{{newsArticle}}

Considering the user's current portfolio:
{{portfolio}}

And their risk preferences:
{{riskPreferences}}

Provide a list of investment recommendations, along with a brief explanation for each recommendation and a risk score between 1 and 10 (1 being the lowest risk, and 10 being the highest risk).
Also provide a summary of your analysis.

Ensure that the recommendations are diverse and align with the user's risk profile.
If the risk preference is low, only provide recommendations with risk scores between 1-3. If the preference is medium, provide recommendations between 4-7. If the preference is high, provide recommendations between 8-10.

Output in JSON format.`, 
});

const recommendInvestmentsFlow = ai.defineFlow(
  {
    name: 'recommendInvestmentsFlow',
    inputSchema: RecommendInvestmentsInputSchema,
    outputSchema: RecommendInvestmentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
