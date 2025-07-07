'use server';
/**
 * @fileOverview An intelligent auto-trading agent.
 *
 * - runAutoTrader - A function that analyzes a portfolio and market data to suggest trades.
 * - AutoTraderInput - The input type for the runAutoTrader function.
 * - AutoTraderOutput - The return type for the runAutoTrader function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HoldingSchema = z.object({
    ticker: z.string(),
    name: z.string(),
    quantity: z.number(),
    avgCost: z.number(),
});

const MarketAssetSchema = z.object({
    ticker: z.string(),
    name: z.string(),
    price: z.number(),
    change24h: z.string(),
});

const AutoTraderInputSchema = z.object({
  cash: z.number().describe('The user\'s available cash for trading.'),
  holdings: z.array(HoldingSchema).describe('The user\'s current asset holdings.'),
  marketAssets: z.array(MarketAssetSchema).describe('The current state of all available assets in the market.'),
});
export type AutoTraderInput = z.infer<typeof AutoTraderInputSchema>;

const TradeActionSchema = z.object({
    action: z.enum(['buy', 'sell']).describe('The action to perform.'),
    ticker: z.string().describe('The ticker symbol of the asset to trade.'),
    quantity: z.number().describe('The quantity of the asset to trade. For stocks, this should be a whole number.'),
    reason: z.string().describe('A brief justification for this specific trade action.'),
});

const AutoTraderOutputSchema = z.object({
  trades: z.array(TradeActionSchema).describe('A list of 1 to 3 trades to execute now. Can be an empty array if no action is advised.'),
  summary: z.string().describe('A brief, one-sentence summary of the overall strategy for this trading cycle (e.g., "Taking profits in tech stocks and diversifying into crypto.")'),
});
export type AutoTraderOutput = z.infer<typeof AutoTraderOutputSchema>;

export async function runAutoTrader(input: AutoTraderInput): Promise<AutoTraderOutput> {
    return autoTraderFlow(input);
}

const prompt = ai.definePrompt({
    name: 'autoTraderPrompt',
    input: {schema: AutoTraderInputSchema},
    output: {schema: AutoTraderOutputSchema},
    prompt: `You are an intelligent, conservative trading bot for a financial simulation game.
Your goal is to grow the user's portfolio over time by making smart, small trades.
Do not be reckless. It is better to make no trade than a bad trade.

Analyze the user's current portfolio (cash and holdings) and the overall market conditions.
Based on your analysis, propose a maximum of 3 trades (buy or sell). If no trades are advisable right now, return an empty array for trades.

- When buying, use a small portion of the available cash (e.g., 5-15%). Do not spend all the cash.
- When selling, consider taking profits on assets that have performed well or cutting losses on those performing poorly.
- For stocks (not crypto), the quantity to trade must be a whole number.
- Provide a clear, concise reason for each trade.
- Provide a one-sentence summary of your overall strategy for this cycle.

User's Cash: \${{cash}}

User's Holdings:
{{#each holdings}}
- {{name}} ({{ticker}}): {{quantity}} units @ avg cost of \${{avgCost}}
{{/each}}

Market Assets:
{{#each marketAssets}}
- {{name}} ({{ticker}}): \${{price}} ({{change24h}})
{{/each}}
`,
});

const autoTraderFlow = ai.defineFlow(
    {
        name: 'autoTraderFlow',
        inputSchema: AutoTraderInputSchema,
        outputSchema: AutoTraderOutputSchema,
    },
    async (input) => {
        const {output} = await prompt(input);
        return output!;
    }
);
