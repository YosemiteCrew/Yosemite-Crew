import type { NextFunction, Request, Response } from "express";
import { createSessionMiddleware, type AuthSession } from "@yosemite-crew/auth";

// Re-anchor the package middleware to this app's express types with the same
// concrete signature the previous middlewares had (the package declares its
// own @types/express dev copy; the runtime value is identical).
type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

const asHandler = (handler: unknown): AuthMiddleware =>
  handler as AuthMiddleware;

// Provider-neutral session guards. The provider (SuperTokens today) is
// selected at deployment time via AUTH_PROVIDER and wired up in app.ts; this
// module never touches a provider SDK. During the cutover grace window
// (AUTH_LEGACY_TOKEN_GRACE=true) the middleware also accepts residual tokens
// from the previous providers, scoped to the profile their issuer served.

// Claims of the verified session token. Kept intentionally loose: product code
// must rely on the normalized fields below (userId, email, ...), not on
// provider-specific claim names.
export type AuthClaims = Record<string, unknown> & {
  sub?: string;
  email?: string;
};

export type AuthenticatedRequest<
  TParams = Request["params"],
  TResBody = unknown,
  TReqBody = unknown,
  TLocals extends Record<string, unknown> = Record<string, unknown>,
> = Request<TParams, TResBody, TReqBody, TLocals> & {
  auth?: AuthClaims;
  userId?: string;
  provider?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  authSession?: AuthSession;
};

// Staff / PIMS web product routes.
export const requireWebAuth = asHandler(
  createSessionMiddleware({ profile: "pims_web" }),
);

// Pet-parent mobile product routes.
export const requireMobileAuth = asHandler(
  createSessionMiddleware({ profile: "pet_parent_mobile" }),
);

// Routes shared by both products (e.g. /v1/auth/me, logout).
export const requireAnyAuth = asHandler(createSessionMiddleware());
