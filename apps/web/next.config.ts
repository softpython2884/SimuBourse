import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://127.0.0.1:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The API and the web app are separate processes; in production nginx puts them
  // on one origin, and in development this rewrite does the same job so cookies
  // and the WebSocket handshake behave identically in both.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/ws/:path*', destination: `${apiOrigin}/ws/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  transpilePackages: ['@alvora/shared'],
  outputFileTracingRoot: process.cwd().replace(/\/apps\/web$/, ''),
  typedRoutes: false,
};

export default config;
