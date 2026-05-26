// Kill-switch service worker.
// This project does NOT use service workers. If a stale SW from a previous app
// is still registered on localhost (or wherever you're hosting), it can serve
// outdated cached chunks (404s on _next/static/...) or intercept redirects.
// Serving THIS file at /sw.js makes the browser update the registration to a
// no-op that uninstalls itself on activate.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    try {
      await self.registration.unregister();
    } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch {}
  })());
});

// Never intercept fetches — always go to network.
self.addEventListener('fetch', () => {});
