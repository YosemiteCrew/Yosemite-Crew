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
   * Docusaurus links extensionlessly - `/dev-docs/apps/backend` - while writing
   * `apps/backend.html`, so on the deployed site every internal link 404'd:
   * only `/dev-docs/index.html`, typed by hand, ever loaded.
   *
   * These are REDIRECTS, not rewrites, and that distinction is the whole fix.
   * A rewrite is what this started as, and it works locally and nowhere else:
   * `next dev` serves `public/` itself, so an internal rewrite to a file in it
   * resolves. On Amplify it cannot. Amplify serves everything under `public/`
   * from its own CDN layer (see customHttp.yml, which exists for exactly that
   * reason), and the Next server has no route for a file it does not serve - so
   * the rewrite fired and then 404'd. Verified on the deployed site: a request
   * for `/dev-docs/apps/backend` came back 404 with `x-nextjs-cache: HIT`,
   * meaning Next answered, while `/dev-docs/apps/backend.html` came back 200
   * from CloudFront with an ETag and no Next headers at all.
   *
   * A redirect sends the browser to the `.html` path instead, which CloudFront
   * does serve. The trade is a visible `.html` in the URL. The alternative that
   * keeps clean URLs is a rewrite rule in the Amplify console, which is not in
   * this repo and cannot be reviewed with the code.
   *
   * `permanent: false` deliberately: a 308 is cached hard by browsers, and if
   * the console rule is added later these should stop firing without users
   * carrying a stale permanent redirect.
   *
   * Only extensionless paths match, so real assets - `/dev-docs/img/x.png`,
   * `/dev-docs/assets/x.css` - are untouched and keep being served directly.
   */
  async redirects() {
    return [
      // The docs' own logo links to `/dev-docs/`, which this app redirects to
      // `/dev-docs`; without this that link 404s.
      {
        source: '/dev-docs',
        destination: '/dev-docs/index.html',
        permanent: false,
      },
      {
        source: '/dev-docs/:path((?!.*\\.).*)',
        destination: '/dev-docs/:path.html',
        permanent: false,
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
