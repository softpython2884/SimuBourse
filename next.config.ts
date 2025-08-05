import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['@genkit-ai/googleai'],
    },
};

export default nextConfig;
