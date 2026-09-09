import { NextRequest } from 'next/server';
import { startMarketsResolver, subscribeMarkets } from '@/lib/markets-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  startMarketsResolver();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(sseFrame(event, data))); } catch {}
      };

      send('ready', { t: Date.now() });

      const unsubscribe = subscribeMarkets((evt) => {
        send('market', evt);
      });

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
