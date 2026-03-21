import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'd2il6osz49gpup.cloudfront.net' },
      { protocol: 'https', hostname: 'd2kyjiikho62xx.cloudfront.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      {
        protocol: 'https',
        hostname: 'yosemitecrew-backend.s3.eu-central-1.amazonaws.com',
      },
      { protocol: 'https', hostname: 'cdn.yc.dev' },
    ],
  },
  outputFileTracingExcludes: {
    'apps/frontend/**': ['**/.pnpm/**', '**/node_modules/.pnpm/**', '**/.turbo/**'],
  },
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
