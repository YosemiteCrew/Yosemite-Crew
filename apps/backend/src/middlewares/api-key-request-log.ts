import type { NextFunction, Request, Response } from "express";
import type { ApiKeyRequest } from "src/middlewares/api-key-auth";
import { DeveloperRequestLogService } from "src/services/developer-request-log.service";
import logger from "src/utils/logger";

// Data-plane request logging. Mounted ONCE, in front of the /v1/developer
// router (routers/index.ts), so every data-plane request passes through it.
//
// Guarantees:
// - Never blocks or fails a request: the row is written fire-and-forget on the
//   response "finish" event and any persistence error is swallowed and logged.
// - Only logs requests attributable to a verified key (req.apiKey is set by
//   the auth middleware). Requests rejected before verification (missing or
//   invalid key) have no organisation or key to attribute the row to, so they
//   are not logged; they remain visible in the application logs.
// - path stores the matched route pattern (req.route.path, e.g.
//   "/v1/developer/appointments/:id"). When no route matched (rate limit or
//   quota rejections fire from router-level middleware, and 404s never match),
//   it falls back to req.path, which never includes a query string.

const normalizedPath = (req: Request): string => {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  const suffix = routePath ?? req.path;
  const combined = `${req.baseUrl}${suffix === "/" ? "" : suffix}`;
  return combined || "/";
};

export const captureApiKeyRequestLog = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startedAt = Date.now();

  // Sniff the machine-readable error code out of the standard error envelope
  // ({ message, code }) as it is serialized, so 4xx/5xx rows carry it.
  let errorCode: string | null = null;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === "object") {
      const code = (body as { code?: unknown }).code;
      if (typeof code === "string") {
        errorCode = code;
      }
    }
    return originalJson(body);
  };

  res.on("finish", () => {
    const apiKey = (req as ApiKeyRequest).apiKey;
    if (!apiKey) {
      return;
    }
    void DeveloperRequestLogService.record({
      organisationId: apiKey.organisationId,
      apiKeyId: apiKey.id,
      method: req.method,
      path: normalizedPath(req),
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      errorCode: res.statusCode >= 400 ? errorCode : null,
      environment: apiKey.environment,
    }).catch((error) => {
      logger.error("Failed to record developer API request log", { error });
    });
  });

  next();
};
