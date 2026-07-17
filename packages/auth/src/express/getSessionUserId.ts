import type { SessionRequest } from 'supertokens-node/framework/express';
import { getAuthHooks } from '../hooks.js';
import type { AuthProfile, AuthProviderName, LoginMethod } from '../types.js';

export type SessionIdentityInput = {
  appUserId: string;
  providerUserId: string;
  provider: AuthProviderName;
  authProfile?: AuthProfile;
  email?: string;
  loginMethod: LoginMethod;
  claims: Record<string, unknown>;
};

export async function resolveAppUserId(input: SessionIdentityInput): Promise<string> {
  const hook = getAuthHooks().resolveAppUserId;
  if (!hook) {
    return input.appUserId;
  }

  try {
    return (await hook(input)) ?? input.appUserId;
  } catch (err) {
    console.error('[auth] resolveAppUserId hook failed', err);
    return input.appUserId;
  }
}

export async function getSessionUserId(req: SessionRequest): Promise<string> {
  const session = req.session;
  const userId = session?.getUserId();

  if (!userId) {
    throw new Error('[auth] Session user id is missing');
  }

  const activeSession = session as NonNullable<SessionRequest['session']>;
  const payload = activeSession.getAccessTokenPayload() as Record<string, unknown>;
  const providerUserId = activeSession.getRecipeUserId().getAsString();
  const loginMethod =
    typeof payload.loginMethod === 'string' ? (payload.loginMethod as LoginMethod) : 'unknown';

  return resolveAppUserId({
    appUserId: userId,
    providerUserId,
    provider: 'supertokens',
    authProfile:
      payload.authProfile === 'pims_web' || payload.authProfile === 'pet_parent_mobile'
        ? (payload.authProfile as AuthProfile)
        : undefined,
    email: typeof payload.sessionEmail === 'string' ? payload.sessionEmail : undefined,
    loginMethod,
    claims: payload,
  });
}
