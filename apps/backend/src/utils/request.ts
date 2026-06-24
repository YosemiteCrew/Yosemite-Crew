import type { Request } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";

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
