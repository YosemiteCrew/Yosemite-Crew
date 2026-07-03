import Session from 'supertokens-node/recipe/session';
import type { Request, Response } from 'express';

import type { AuthProvider } from '../../auth-provider.js';
import type {
  AuthMfaState,
  AuthProfile,
  AuthSession,
  LoginMethod,
  RequestContext,
} from '../../types.js';
import { AuthRequiredError } from '../../errors.js';

// SuperTokens adapter. This is the ONLY place outside SuperTokens setup that may
// import the SuperTokens SDK. It converts a SuperTokens session into the
// provider-neutral AuthSession the rest of the app consumes.
//
// NOTE: SuperTokens.init(...) is performed by the existing initSuperTokens()
// setup; this adapter only reads/revokes sessions. Role/permission resolution is
// intentionally app-owned (DB-backed RBAC), not taken from provider claims.

// Shape of the MultiFactorAuth claim SuperTokens stores in the access token
// payload: { c: { [factorId]: completedAtEpochSeconds }, v: allRequirementsMet }.
type StMfaClaim = { c?: Record<string, number>; v?: boolean };

const AUTH_PROFILE_CLAIM = 'authProfile';
const LOGIN_METHOD_CLAIM = 'loginMethod';
const EMAIL_CLAIM = 'sessionEmail';

const KNOWN_PROFILES: readonly AuthProfile[] = ['pims_web', 'pet_parent_mobile'];

function readProfile(payload: Record<string, unknown>): AuthProfile | undefined {
  const value = payload[AUTH_PROFILE_CLAIM];
  return KNOWN_PROFILES.includes(value as AuthProfile) ? (value as AuthProfile) : undefined;
}

function readMfaState(payload: Record<string, unknown>): AuthMfaState | undefined {
  const claim = payload['st-mfa'] as StMfaClaim | undefined;
  if (!claim || typeof claim !== 'object') {
    return undefined;
  }
  const completedFactors = Object.keys(claim.c ?? {});
  return {
    required: claim.v === false || completedFactors.length > 0,
    completed: claim.v !== false,
    completedFactors,
  };
}

export class SuperTokensAuthProvider implements AuthProvider {
  readonly name = 'supertokens' as const;

  async getSession(ctx: RequestContext): Promise<AuthSession | null> {
    const req = ctx.req as Request;
    const res = ctx.res as Response;

    let session;
    try {
      // Global claim validators (email verification, MFA policy) run here, so
      // the policy is enforced centrally on every product route.
      session = await Session.getSession(req, res, { sessionRequired: false });
    } catch (err) {
      if (
        Session.Error.isErrorFromSuperTokens(err) &&
        (err as { type?: string }).type === 'UNAUTHORISED'
      ) {
        // No session at all - the caller may fall back to the legacy grace
        // verifier or reply 401.
        return null;
      }
      // TRY_REFRESH_TOKEN / INVALID_CLAIMS etc. propagate so the SuperTokens
      // error handler emits the SDK-standard 401/403 bodies that drive the
      // web/mobile SDKs' refresh and claim-resolution flows.
      throw err;
    }

    if (!session) {
      return null;
    }

    const payload = session.getAccessTokenPayload() as Record<string, unknown>;

    // With UserId Mapping in place, getUserId() returns the mapped external id
    // (the pre-existing stable app user id) for migrated users, and the native
    // SuperTokens id for new users - either way it IS the appUserId, so all
    // existing foreign keys and request scoping remain valid.
    const appUserId = session.getUserId();

    return {
      appUserId,
      provider: 'supertokens',
      authProfile: readProfile(payload),
      providerUserId: session.getRecipeUserId().getAsString(),
      loginMethod: (payload[LOGIN_METHOD_CLAIM] as LoginMethod) ?? 'unknown',
      email:
        typeof payload[EMAIL_CLAIM] === 'string' ? (payload[EMAIL_CLAIM] as string) : undefined,
      emailVerified:
        typeof payload['st-ev'] === 'object' && payload['st-ev'] !== null
          ? Boolean((payload['st-ev'] as { v?: boolean }).v)
          : undefined,
      roles: [],
      permissions: [],
      claims: payload,
      mfa: readMfaState(payload),
    };
  }

  async requireSession(ctx: RequestContext): Promise<AuthSession> {
    const session = await this.getSession(ctx);
    if (!session) {
      throw new AuthRequiredError();
    }
    return session;
  }

  async signOut(ctx: RequestContext): Promise<void> {
    const req = ctx.req as Request;
    const res = ctx.res as Response;

    let session;
    try {
      session = await Session.getSession(req, res, {
        sessionRequired: false,
        // Logout must succeed even when claims (MFA, email verification) are
        // unsatisfied - only the session's existence matters here.
        overrideGlobalClaimValidators: () => [],
      });
    } catch (err) {
      // Signing out with an expired or invalid token is a no-op, not an error.
      if (Session.Error.isErrorFromSuperTokens(err)) {
        return;
      }
      throw err;
    }

    if (session) {
      await session.revokeSession();
    }
  }
}
