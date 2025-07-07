'use server';

import { runAutoTrader, AutoTraderInput, AutoTraderOutput } from "@/ai/flows/auto-trader-flow";

export async function getAiTradingActions(input: AutoTraderInput): Promise<AutoTraderOutput> {
    try {
        const result = await runAutoTrader(input);
        return result;
    } catch (error) {
        console.error("Error getting AI trading actions:", error);
        // Return a safe, empty response on error
        return {
            trades: [],
            summary: "L'IA n'a pas pu déterminer d'actions pour le moment.",
        }
    }
}
