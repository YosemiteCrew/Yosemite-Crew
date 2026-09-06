import { NextResponse } from 'next/server';

/**
 * What is actually deployed here.
 *
 * `buildSha` is baked in by `next.config.ts` at build time; see
 * `src/buildInfo.ts` for why it cannot come from the Amplify build spec and why
 * the source is reported alongside it.
 *
 * `force-dynamic` and `no-store` are the point of this route, not boilerplate.
 * A cached health response answers with the *previous* deploy's sha, so the one
 * instrument for "did my change ship?" would report success for a build that
 * never happened - the reassuring direction. The app sets a long-lived cache
 * policy on other paths and sits behind a CDN, so opting out has to be explicit
 * here.
 *
 * Nothing secret is exposed: a commit sha for a public repository, and a label
 * saying where it was read from.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

export function GET() {
  // Read through `process.env` rather than destructuring at module scope: Next
  // inlines these at build time, and a module-scope read would be evaluated
  // once during prerender even with `force-dynamic` set on the route.
  // `|| null`, not `?? null`: `next.config.ts` inlines BUILD_SHA as an empty
  // string when the build could not identify itself, and a blank string here
  // would serialise as a populated-looking empty field.
  const sha = process.env.BUILD_SHA?.trim() || null;
  const source = process.env.BUILD_SHA_SOURCE ?? 'unavailable';

  return NextResponse.json(
    {
      status: 'ok',
      // Explicitly null rather than omitted when unknown. A missing key reads
      // as "this deploy predates the field"; null reads as "this build could
      // not identify itself", which is a different and reportable state.
      buildSha: sha,
      buildShaSource: source,
    },
    { headers: NO_STORE }
  );
}
