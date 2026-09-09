import { NextRequest } from 'next/server';
import { getPriceSnapshot, startPriceSimulator, subscribePrices, type PriceUpdate } from '@/lib/price-simulator';

// Node runtime is required: better-sqlite3 won't run on the Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  await startPriceSimulator();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(sseFrame(event, data))); } catch {}
      };

      // Send initial snapshot immediately so clients can render before the first tick.
      const snapshot = await getPriceSnapshot();
      send('prices', snapshot);

      const unsubscribe = subscribePrices((updates: PriceUpdate[]) => {
        send('prices', updates);
      });

      // Heartbeat every 25s to keep proxies from closing the connection.
      const heartbeat = setInterval(() => send('ping', { t: Date.now() }), 25000);

      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
