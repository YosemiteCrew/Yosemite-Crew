import type { Request } from "express";
import { resolveVerifiedUserId } from "src/utils/request";

/**
 * Rate-limit bucket key built only from inputs the caller cannot forge.
 *
 * A limiter runs BEFORE the org-permission middleware has validated anything,
 * so folding the `x-org-id` header into the key let one session mint a fresh
 * bucket per header value and sail past the limit. Route params are safe by
 * comparison - they address a specific resource, and RBAC rejects the request
 * afterwards if the caller has no business with it - but the *identity* half of
 * the key has to come from the verified session.
 *
 * `extraParams` names the route params that make a bucket meaningfully distinct
 * (an appointment, an invoice). Missing ones collapse to a constant, which
 * tightens the limit rather than loosening it.
 */
export const buildRateLimitKey = (
  req: Request,
  extraParams: readonly string[] = [],
): string => {
  const userId = resolveVerifiedUserId(req) ?? "unknown-user";
  const orgId = req.params.organisationId ?? "unknown-org";
  const extras = extraParams.map(
    (name) => req.params[name] ?? `unknown-${name}`,
  );
  return [orgId, userId, ...extras].join(":");
};
