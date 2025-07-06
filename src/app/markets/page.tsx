import { ensureAiMarkets, getOpenMarkets } from '@/lib/actions/markets';
import { MarketsClientPage } from '@/components/markets-client-page';


export default async function PredictionMarketsPage() {
  await ensureAiMarkets();
  const markets = await getOpenMarkets();

  return <MarketsClientPage initialMarkets={markets} />;
}
