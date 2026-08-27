import type { NextFunction, Request, Response } from "express";
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

// Authenticates a request with a developer API key (Authorization: Bearer yc_...
// or X-API-Key). On success the request is bound to the key's organisation so the
// existing org-scoped RBAC applies; agents and servers use this path, never a
// browser session.
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
    verified.organisationId,
  );
  if (!usage.allowed) {
    return res.status(429).json({
      message: "Monthly API quota exceeded. Upgrade to Pro to continue.",
    });
  }

  (req as ApiKeyRequest).apiKey = verified;
  (req as OrgRequest).organisationId = verified.organisationId;
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
