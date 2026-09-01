import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import {
  DeveloperApiKeyService,
  type VerifiedApiKey,
} from "src/services/developer-api-key.service";
import { DeveloperUsageService } from "src/services/developer-usage.service";

export interface ApiKeyRequest extends Request {
  apiKey?: VerifiedApiKey;
}

const extractApiKey = (req: Request): string | undefined => {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim() || undefined;
  }
  return req.header("x-api-key")?.trim() || undefined;
};

/*
 * Authenticates a request with a developer API key (`Authorization: Bearer yc_…`
 * or `X-API-Key`). Agents and servers use this path, never a browser session.
 *
 * A key identifies a PERSON, not a practice. It binds `userId`, the same field a
 * session sets, so anything downstream that already reads the caller's identity
 * works unchanged.
 *
 * The previous comment claimed the request was bound to the key's organisation
 * "so the existing org-scoped RBAC applies". That composition could not run:
 * this set only `organisationId` and never `userId`, while `withOrgPermissions()`
 * requires both and answers 400 without the second. Nothing noticed because the
 * middleware is mounted on no route.
 *
 * To scope a public route to a practice, compose `authorizeApiKey` with
 * `withOrgPermissions()` and `requirePermission(...)`: the organisation arrives
 * in `x-org-id` or the path exactly as it does for a browser session, and
 * `withOrgPermissions()` checks it against the owner's live `active: true`
 * membership on every request. That is what makes an offboarded key holder stop
 * reaching their former employer, which a key carrying a baked-in organisation
 * could never do.
 */
export const authorizeApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void | Response> => {
  const presented = extractApiKey(req);
  if (!presented) {
    return res.status(401).json({ message: "Missing API key" });
  }

  const verified = await DeveloperApiKeyService.verify(presented);
  if (!verified) {
    return res.status(401).json({ message: "Invalid or expired API key" });
  }

  const usage = await DeveloperUsageService.incrementAndCheck(
    verified.ownerUserId,
  );
  if (!usage.allowed) {
    return res.status(429).json({
      message: "Monthly API quota exceeded. Upgrade to Pro to continue.",
    });
  }

  (req as ApiKeyRequest).apiKey = verified;
  (req as AuthenticatedRequest).userId = verified.ownerUserId;
  return next();
};

// Enforces a key scope. A key carrying the wildcard "*" scope passes everything.
export const requireScope =
  (scope: string) =>
  (req: Request, res: Response, next: NextFunction): void | Response => {
    const scopes = (req as ApiKeyRequest).apiKey?.scopes ?? [];
    if (!scopes.includes(scope) && !scopes.includes("*")) {
      return res
        .status(403)
        .json({ message: "Insufficient scope for this API key" });
    }
    return next();
  };
