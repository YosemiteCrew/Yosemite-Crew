import SuperTokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import UserMetadata from 'supertokens-node/recipe/usermetadata';
import UserRoles from 'supertokens-node/recipe/userroles';
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
import { resolveAppUserId } from '../../express/getSessionUserId.js';

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
type StRolesClaim = { v?: unknown };

const DEFAULT_TENANT_ID = 'public';

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

function readRoles(payload: Record<string, unknown>): string[] {
  const claim = payload['st-role'] as StRolesClaim | undefined;
  const roles = claim?.v;
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter((role): role is string => typeof role === 'string');
}

async function readSessionRoles(
  session: unknown,
  payload: Record<string, unknown>
): Promise<string[]> {
  const claimSession = session as {
    getClaimValue?<T>(claim: T): Promise<T | undefined>;
  };

  if (claimSession.getClaimValue) {
    try {
      const claimValue = await claimSession.getClaimValue(UserRoles.UserRoleClaim);
      if (Array.isArray(claimValue)) {
        return claimValue.filter((role): role is string => typeof role === 'string');
      }
    } catch {
      // Fall back to the token payload shape below.
    }
  }

  return readRoles(payload);
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
    const appUserId = await resolveAppUserId({
      appUserId: session.getUserId(),
      providerUserId: session.getRecipeUserId().getAsString(),
      provider: 'supertokens',
      authProfile: readProfile(payload),
      email:
        typeof payload[EMAIL_CLAIM] === 'string' ? (payload[EMAIL_CLAIM] as string) : undefined,
      loginMethod: (payload[LOGIN_METHOD_CLAIM] as LoginMethod) ?? 'unknown',
      claims: payload,
    });

    const roles = await readSessionRoles(session, payload);

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
      roles,
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

  async updateUserName(
    appUserId: string,
    name: { firstName: string; lastName: string }
  ): Promise<void> {
    // SuperTokens functions accept the external (mapped) user id directly.
    await UserMetadata.updateUserMetadata(appUserId, {
      first_name: name.firstName,
      last_name: name.lastName,
    });
  }

  async getUserMetadata(appUserId: string): Promise<Record<string, unknown>> {
    const result = await UserMetadata.getUserMetadata(appUserId);
    return (result.metadata as Record<string, unknown>) ?? {};
  }

  async getUserRoles(appUserId: string, tenantId = DEFAULT_TENANT_ID): Promise<string[]> {
    const result = await UserRoles.getRolesForUser(tenantId, appUserId);
    return result.roles ?? [];
  }

  async setUserRole(appUserId: string, role: string): Promise<void> {
    await UserRoles.createNewRoleOrAddPermissions(role, []);
    await UserRoles.addRoleToUser(DEFAULT_TENANT_ID, appUserId, role);
    await UserMetadata.updateUserMetadata(appUserId, { role });
  }

  /**
   * Takes one role off the user. Paired with `setUserRole`, which ADDS: a
   * caller correcting a role has to drop the previous one itself, or the user
   * ends up holding both and `/v1/auth/me` answers with whichever the role
   * list happens to return first.
   *
   * Removing a role the user does not have is a no-op, not an error, so the
   * caller need not read the current roles first.
   */
  async removeUserRole(appUserId: string, role: string): Promise<void> {
    await UserRoles.removeUserRole(DEFAULT_TENANT_ID, appUserId, role);
  }

  async deleteUser(appUserId: string): Promise<void> {
    await SuperTokens.deleteUser(appUserId);
  }
}
