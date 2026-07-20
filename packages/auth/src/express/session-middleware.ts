import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { getAuthService } from '../auth-service-registry.js';
import { AuthError } from '../errors.js';
import type { AuthProfile, AuthSession } from '../types.js';
import {
  isLegacyTokenGraceEnabled,
  verifyLegacyBearerToken,
} from '../providers/legacy-cognito/legacy-token-verifier.js';

// Fields the neutral middleware sets on the request. apps/backend re-exports
// its AuthenticatedRequest type with this exact shape (the pre-migration
// contract), so ~80 consumers keep compiling unchanged.
export type SessionRequestFields = {
  auth?: Record<string, unknown>;
  userId?: string;
  provider?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  authSession?: AuthSession;
};

export type SessionMiddlewareOptions = {
  // Which product profile this route group belongs to. Sessions stamped with a
  // different profile are rejected (403). Omit to accept any profile.
  profile?: AuthProfile;
  // When true the guard never rejects: a missing (or wrong-profile) session
  // lets the request proceed unauthenticated, with no session fields set on
  // the request. Public routes that only *enrich* their response for signed-in
  // callers use this so a valid session is attached when present without
  // turning the route into an authenticated-only surface.
  optional?: boolean;
};

function applySession(req: Request, session: AuthSession): void {
  const target = req as Request & SessionRequestFields;
  target.auth = session.claims;
  target.userId = session.appUserId;
  target.provider = session.provider;
  target.email = session.email;
  target.emailVerified = session.emailVerified;
  target.firstName = session.firstName;
  target.lastName = session.lastName;
  target.authSession = session;
}

async function tryLegacyGrace(req: Request): Promise<AuthSession | null> {
  if (!isLegacyTokenGraceEnabled()) {
    return null;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return verifyLegacyBearerToken(header.slice('Bearer '.length).trim());
}

// Builds the neutral session guard product routes use. Provider-agnostic:
// resolves the configured AuthService from the registry per request, so app
// startup order does not matter and tests can swap the service.
export function createSessionMiddleware(options: SessionMiddlewareOptions = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = getAuthService();

      let session: AuthSession | null = null;
      if (service) {
        session = await service.getSession({ req, res });
      }

      // Legacy grace tokens carry a profile derived from their issuer (the
      // legacy pools were product-scoped), so both paths get the same check.
      session ??= await tryLegacyGrace(req);

      if (!session) {
        if (options.optional) {
          next();
          return;
        }
        res.status(401).json({ message: 'Authentication required' });
        return;
      }

      if (options.profile && session.authProfile !== options.profile) {
        if (options.optional) {
          next();
          return;
        }
        res.status(403).json({ message: 'Session not valid for this resource' });
        return;
      }

      applySession(req, session);
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ message: err.message });
        return;
      }
      next(err);
    }
  };
}
