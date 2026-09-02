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

// Files under /public are served with a fixed name and are only replaced by a
// deploy, but Amplify hands them out with `max-age=5` — every visit re-fetches
// the fonts and marketing art from the origin and CloudFront edges never stay
// warm. Fonts are immutable (a new cut ships under a new filename); images can
// be swapped in place, so they get a one-day freshness window and a month of
// stale-while-revalidate rather than `immutable`.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const REVALIDATING_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=2592000';

const cacheControl = (value: string) => [{ key: 'Cache-Control', value }];

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
      // Sub-processor logos on the Trust Center. next/image throws for a host it
      // does not know, which takes the page down rather than dropping an image.
      // These should be served from our own CDN so the page makes no
      // third-party request; the path is pinned until those assets exist.
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/wikipedia/commons/**',
      },
      // Live contributor + commit avatars on the public Insights page.
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
  // Do not advertise the framework/version in responses (X-Powered-By).
  poweredByHeader: false,
  /*
   * The developer docs are a Docusaurus build copied into `public/dev-docs`.
   * It links extensionlessly - `/dev-docs/apps/backend` - while writing
   * `apps/backend.html`, so on the deployed site every internal link 404'd:
   * only `/dev-docs/index.html`, typed by hand, ever loaded.
   *
   * Setting `trailingSlash: true` in Docusaurus does not fix it. This app
   * leaves `trailingSlash` at its default of false, so it 308-redirects
   * `/dev-docs/x/` to `/dev-docs/x` and the slashed links would land back on
   * the same 404.
   *
   * The rewrite runs after filesystem routes, so a real asset (`/img/x.png`,
   * `/assets/x.css`) is served directly and never reaches it. Only a path with
   * no extension is mapped onto its `.html` file.
   */
  async rewrites() {
    return [
      // The site's own home link is `/dev-docs/`, which this app redirects to
      // `/dev-docs`; without this the docs' own logo link 404s.
      {
        source: '/dev-docs',
        destination: '/dev-docs/index.html',
      },
      {
        source: '/dev-docs/:path((?!.*\\.).*)',
        destination: '/dev-docs/:path.html',
      },
    ];
  },

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
      {
        source: '/fonts/:path*',
        headers: cacheControl(IMMUTABLE_CACHE_CONTROL),
      },
      {
        source: '/images/:path*',
        headers: cacheControl(REVALIDATING_CACHE_CONTROL),
      },
    ];
  },
};

export default nextConfig;
