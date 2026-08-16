import type { Request } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import type { OrgRequest } from "src/middlewares/rbac";

/**
 * The caller identity as established by the auth middleware, with no header fallback.
 * Use this — never `resolveUserIdFromRequest` — for any authorization decision.
 */
export const resolveVerifiedUserId = (req: Request): string | undefined => {
  const userId = (req as AuthenticatedRequest).userId;
  if (typeof userId !== "string") return undefined;
  return userId.trim() || undefined;
};

/**
 * The acting organisation as established by `withOrgPermissions`, which only sets it after
 * confirming the caller is an active member. Undefined on routes that are merely
 * authenticated, so an audit org can never be taken from an unvalidated `x-org-id` header.
 */
export const resolveVerifiedOrganisationId = (
  req: Request,
): string | undefined => {
  const organisationId = (req as OrgRequest).organisationId;
  if (typeof organisationId !== "string") return undefined;
  return organisationId.trim() || undefined;
};

export const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const userId = authRequest.userId;
  if (typeof userId === "string") {
    const trimmedUserId = userId.trim();
    return trimmedUserId || undefined;
  }

  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") {
    const trimmedHeader = headerUserId.trim();
    if (trimmedHeader) return trimmedHeader;
  }

  return undefined;
};

/**
 * Resolve the acting organisation for a request from the route params, the `x-org-id`
 * header, or the body — without requiring the full org-permission middleware. Used to
 * scope audit events (org is required by the audit trail) on endpoints that are only
 * authenticated, not org-gated. Returns undefined when no organisation context is present
 * (callers should degrade gracefully — e.g. skip the audit rather than fail the request).
 */
export const resolveOrganisationIdFromRequest = (
  req: Request,
): string | undefined => {
  const params = req.params ?? {};
  const fromParams =
    params.organisationId ?? params.organizationId ?? params.orgId;
  if (typeof fromParams === "string" && fromParams.trim())
    return fromParams.trim();

  const header = req.headers?.["x-org-id"];
  if (typeof header === "string" && header.trim()) return header.trim();

  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = body?.organisationId ?? body?.organizationId;
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();

  return undefined;
};
