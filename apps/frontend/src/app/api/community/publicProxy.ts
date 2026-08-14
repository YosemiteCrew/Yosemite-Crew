import { NextResponse } from 'next/server';

/**
 * Shared rules for the public read-only proxies in this folder.
 *
 * These routes exist so the browser makes one same-origin request instead of
 * several third-party ones, and so visitors' IPs stay with us. That means they
 * are unauthenticated endpoints which perform outbound work, so they need two
 * properties the naive version did not have.
 */

export const CACHE_TTL_SECONDS = 300;

/**
 * Cache in shared caches only.
 *
 * `max-age` would let the browser answer from its own cache, which contradicts
 * the surfaces that advertise live, uncached numbers. `s-maxage` keeps the CDN
 * serving repeat traffic for the whole window while the browser still asks us
 * every time, and that ask is cheap because it is same-origin and usually a 304.
 */
export const CACHED_HEADERS = {
  'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}, max-age=0, must-revalidate`,
} as const;

/** Nothing is cached, so the next request retries rather than replaying a failure. */
export const UNCACHED_HEADERS = { 'Cache-Control': 'no-store' } as const;

/**
 * Reject query parameters the route does not use.
 *
 * Shared caches key on the full URL, so `?nonce=<random>` would miss the cache
 * on every request and make each one do the upstream work again. That turns a
 * public endpoint into an easy way to burn the server's shared GitHub quota for
 * everybody. Unknown parameters are refused before any outbound call happens.
 */
export const rejectUnexpectedParams = (
  request: Request,
  allowed: readonly string[]
): NextResponse | null => {
  const extra = [...new URL(request.url).searchParams.keys()].filter(
    (key) => !allowed.includes(key)
  );
  if (extra.length === 0) return null;

  return NextResponse.json(
    {
      error: `Unsupported query parameter: ${extra
        .toSorted((a, b) => a.localeCompare(b))
        .join(', ')}`,
    },
    { status: 400, headers: UNCACHED_HEADERS }
  );
};
