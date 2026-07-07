import type { NextFunction, Request, Response } from "express";
import { enforceApiKeyRateLimit } from "src/middlewares/api-key-rate-limit";
import type { OrgRequest } from "src/middlewares/rbac";
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

// Quota 429s advertise when the UTC billing month rolls over via Retry-After.
const secondsUntilNextUtcMonth = (): number => {
  const now = new Date();
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((nextMonth - now.getTime()) / 1000));
};

// Authenticates a request with a developer API key (Authorization: Bearer yc_...
// or X-API-Key). On success the request is bound to the key's organisation so the
// existing org-scoped RBAC applies; agents and servers use this path, never a
// browser session. The per-key rate limit runs between key verification and the
// monthly quota increment so rate-limited requests never consume quota
// (contract 5.3); the quota check is skipped for the verify-only variant used by
// GET /v1/developer/usage (contract 3.6).
const createApiKeyAuthorizer =
  ({ enforceQuota }: { enforceQuota: boolean }) =>
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void | Response> => {
    const presented = extractApiKey(req);
    if (!presented) {
      return res
        .status(401)
        .json({ message: "Missing API key", code: "missing_api_key" });
    }

    const verified = await DeveloperApiKeyService.verify(presented);
    if (!verified) {
      return res
        .status(401)
        .json({
          message: "Invalid or expired API key",
          code: "invalid_api_key",
        });
    }

    (req as ApiKeyRequest).apiKey = verified;
    (req as OrgRequest).organisationId = verified.organisationId;

    if (!(await enforceApiKeyRateLimit(req, res))) {
      return;
    }

    if (enforceQuota) {
      const usage = await DeveloperUsageService.incrementAndCheck(
        verified.organisationId,
        verified.environment,
      );
      if (!usage.allowed) {
        res.setHeader("Retry-After", String(secondsUntilNextUtcMonth()));
        return res.status(429).json({
          message: "Monthly API quota exceeded. Upgrade to Pro to continue.",
          code: "quota_exceeded",
        });
      }
    }

    return next();
  };

export const authorizeApiKey = createApiKeyAuthorizer({ enforceQuota: true });

// Verify-only variant for endpoints exempt from the monthly quota increment,
// so an org that has exhausted its quota can still observe that fact.
export const authorizeApiKeyVerifyOnly = createApiKeyAuthorizer({
  enforceQuota: false,
});

// Enforces a key scope. A key carrying the wildcard "*" scope passes everything.
export const requireScope =
  (scope: string) =>
  (req: Request, res: Response, next: NextFunction): void | Response => {
    const scopes = (req as ApiKeyRequest).apiKey?.scopes ?? [];
    if (!scopes.includes(scope) && !scopes.includes("*")) {
      return res.status(403).json({
        message: "Insufficient scope for this API key",
        code: "insufficient_scope",
      });
    }
    return next();
  };
