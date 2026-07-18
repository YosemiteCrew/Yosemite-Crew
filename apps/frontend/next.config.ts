import type { NextConfig } from 'next';
import { securityHeaders } from './src/securityHeaders';

// Static HTML under /public (e.g. /dev-docs/openapi-ui.html) is skipped by the
// edge middleware, which only applies the nonce CSP to app document routes.
// Without this, those pages ship with no Content-Security-Policy and any
// third-party script they load (Redoc's CDN bundle) runs as first-party
// JavaScript with access to same-origin localStorage tokens. Restore a strict,
// tightly allow-listed CSP for the docs surface here.
const DEV_DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.redoc.ly",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://cdn.redoc.ly",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join('; ');

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
      { protocol: 'https', hostname: 'laika.aitemsolutions.com' },
      // Live contributor + commit avatars on the public Insights page.
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
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
  // Do not advertise the framework/version in responses (X-Powered-By).
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/dev-docs/:path*',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: DEV_DOCS_CSP }],
      },
    ];
  },
};

export default nextConfig;
