import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Production builds enforce type + lint correctness.
  // (The previous `ignoreBuildErrors: true` was masking real bugs.)
  reactStrictMode: true,
};

export default nextConfig;
