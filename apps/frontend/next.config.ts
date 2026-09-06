import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';
import { readHeadSha, resolveBuildSha } from './src/buildInfo';
import { securityHeaders } from './src/securityHeaders';

// Static HTML under /public (e.g. /static/openapi/viewer.html) is skipped by the
// edge middleware, which only applies the nonce CSP to app document routes.
// Without this, those pages ship with no Content-Security-Policy and any
// third-party script they load (Redoc's CDN bundle) runs as first-party
// JavaScript with access to same-origin localStorage tokens. Restore a strict,
// tightly allow-listed CSP for the docs surface here.
/*
 * The OpenAPI viewer is a standalone HTML page that loads Redoc from a CDN, so
 * it needs `script-src` to allow that host - the app's default policy does not,
 * and a blocked script renders the page empty with no visible error.
 *
 * Scoped to exactly that one directory. It was previously scoped to
 * /dev-docs/:path*, which covered the whole Docusaurus mirror; now that the
 * documentation is rendered by the app under the normal strict policy, only
 * the viewer needs the exception.
 */
const OPENAPI_VIEWER_CSP = [
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

// Captured here because `next build` is the only step that runs inside the
// Amplify build container's clone, and the build spec that would otherwise do
// it lives in the Amplify console rather than this repository. Read from the
// files rather than by running `git`, so the build spawns nothing and does not
// depend on what `PATH` resolves to inside the container.
const REPO_GIT_DIR = join(__dirname, '..', '..', '.git');

const readFileOrNull = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
};

// Passed explicitly rather than handing over the whole environment: this
// repository's `ProcessEnv` declares its known keys and `AWS_COMMIT_ID` is
// Amplify's, not ours. Naming it here is also the only place a reader can see
// which variable this consumes.
const build = resolveBuildSha({ AWS_COMMIT_ID: process.env.AWS_COMMIT_ID }, () =>
  readHeadSha(REPO_GIT_DIR, readFileOrNull)
);

const nextConfig: NextConfig = {
  // Only set when a sha was actually resolved. An empty string here would be
  // inlined and render as a populated-looking blank field on /api/health, which
  // is the failure this route exists to make visible.
  env: build.sha
    ? { BUILD_SHA: build.sha, BUILD_SHA_SOURCE: build.source }
    : { BUILD_SHA_SOURCE: build.source },
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
   * The documentation moved to /docs, rendered natively by the app. These
   * preserve every URL the Docusaurus site published: an open-source
   * project's docs are linked from outside the repo, and those links are not
   * ours to break.
   *
   * Verified against the shipped sitemap - all 53 published URLs resolve, 52
   * onto a real corpus page and one special case. The corpus slugs are
   * byte-identical to the Docusaurus slugs, which is why `:path*` maps
   * one-to-one with no lookup table.
   *
   * `permanent: true`, unlike the interim `.html` redirect this replaces:
   * that one was deliberately temporary because a better fix existed. This
   * move is final, so the 308 and its SEO signal are what we want.
   */
  async redirects() {
    return [
      // Docusaurus's plugin-generated results page. There is no equivalent -
      // search is inline in the docs header now - so it lands on the index.
      { source: '/dev-docs/search', destination: '/docs', permanent: true },
      { source: '/dev-docs', destination: '/docs', permanent: true },
      { source: '/dev-docs/:path*', destination: '/docs/:path*', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/static/openapi/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: OPENAPI_VIEWER_CSP },
        ],
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
