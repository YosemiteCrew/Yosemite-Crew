// Whether this process is an explicitly-flagged local development run.
//
// Keyed on LOCAL_DEVELOPMENT, the flag this backend already uses for local-only
// behaviour (see app.ts, where it opens CORS to localhost, and the README).
// NODE_ENV is deliberately not the signal: a deployed dev or staging tier
// commonly runs with NODE_ENV=development while being a real remote
// environment, and a local run driven by the documented LOCAL_DEVELOPMENT flag
// may leave NODE_ENV unset. Keying on NODE_ENV would therefore both enable
// local-only endpoints on a deployed tier and disable them for a genuine local
// run.
//
// The comparison is strict rather than truthy so that LOCAL_DEVELOPMENT=false
// disables local-only behaviour instead of enabling it, and the NODE_ENV clause
// is an additional narrowing guard: it can only ever withhold local-only
// behaviour (for instance when a .env carrying LOCAL_DEVELOPMENT=true is copied
// to a production deploy), never grant it.
export function isLocalDevEnvironment(): boolean {
  return (
    process.env.LOCAL_DEVELOPMENT === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
