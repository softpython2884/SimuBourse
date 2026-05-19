// Next.js instrumentation hook — runs once at server startup.
// We use it to stub Node 25's experimental `localStorage` global, which is
// enabled by default but throws if no `--localstorage-file` is set.
// Some bundled deps (Firebase, Genkit) probe `localStorage` at module load.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const g = globalThis as any;
      // Replace any pre-existing broken localStorage with a no-op stub.
      const stub = {
        getItem: (_k: string) => null,
        setItem: (_k: string, _v: string) => {},
        removeItem: (_k: string) => {},
        clear: () => {},
        key: (_i: number) => null,
        length: 0,
      };
      Object.defineProperty(g, 'localStorage', { value: stub, configurable: true, writable: true });
      Object.defineProperty(g, 'sessionStorage', { value: stub, configurable: true, writable: true });
    } catch {}

    // Eagerly start the singletons so dev/prod both have prices/resolver running
    // from the very first request instead of waiting on the first SSE client.
    try {
      const { startPriceSimulator } = await import('./lib/price-simulator');
      await startPriceSimulator();
    } catch (err) {
      console.error('Failed to start price simulator:', err);
    }
    try {
      const { startMarketsResolver } = await import('./lib/markets-resolver');
      startMarketsResolver();
    } catch (err) {
      console.error('Failed to start markets resolver:', err);
    }
  }
}
