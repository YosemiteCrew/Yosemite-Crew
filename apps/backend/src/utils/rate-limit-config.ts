/**
 * The global limiter's ceiling, read from the environment.
 *
 * WHY THIS IS CONFIGURABLE AND NOT AN ALLOWLIST
 *
 * The limit is 500 requests per 15 minutes keyed on client IP. That is shared by
 * everyone behind one address: every member of staff at a practice on one NAT,
 * and every automated check running against an environment. An authenticated
 * page load issues roughly a dozen API calls, so a full end-to-end sweep of the
 * app consumes most of a window on its own, and the symptom is a signed-in user
 * bounced back to the sign-in form with no useful explanation.
 *
 * The obvious shortcut is to exempt the test account. It was considered and
 * rejected twice over. The global limiter runs before any route-level auth
 * middleware, so no verified identity exists at that point and the exemption
 * would have to trust an unverified claim - the precise mistake buildRateLimitKey
 * documents, where folding a caller-supplied header into the key let one session
 * mint unlimited buckets. And an account exemption compiled into the codebase
 * reaches production, turning a shared test credential into permanent unlimited
 * request rights.
 *
 * A per-environment ceiling has neither property. Production keeps the value it
 * has today because that is the default; an environment that needs headroom sets
 * one variable; no credential grants anyone an exemption, because none exists.
 */

/** What production runs with, and what every environment gets unless it says otherwise. */
export const DEFAULT_RATE_LIMIT_MAX = 500;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const resolvePositiveInteger = (
  raw: string | undefined,
  fallback: number,
): number => {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return parsed > 0 ? parsed : fallback;
};

/**
 * Anything that is not a positive integer - unset, empty, a typo, a negative,
 * zero - falls back to the default.
 *
 * Zero deserves its own mention: express-rate-limit treats `max: 0` as "block
 * everything", so a typo producing zero would take the API down rather than
 * loosen it. Falling back is the safe direction for a misconfiguration; failing
 * closed here would mean an unparseable value bricks the service.
 */
export const resolveRateLimitMax = (
  raw: string | undefined,
  fallback: number = DEFAULT_RATE_LIMIT_MAX,
): number => resolvePositiveInteger(raw, fallback);

export const resolveRateLimitWindowMs = (
  raw: string | undefined,
  fallback: number = DEFAULT_RATE_LIMIT_WINDOW_MS,
): number => resolvePositiveInteger(raw, fallback);
