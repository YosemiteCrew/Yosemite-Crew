/**
 * "Continue with GitHub" for developers, via SuperTokens ThirdParty (GitHub).
 *
 * The browser never sees a client secret. SuperTokens builds the GitHub
 * authorisation URL (handling PKCE + CSRF state internally) and the backend
 * GitHub provider (packages/auth) performs the token exchange. The button stays
 * inert until NEXT_PUBLIC_AUTH_GITHUB_ENABLED is set, so it never appears
 * half-wired; the backend provider is separately gated on AUTH_GITHUB_CLIENT_ID.
 */
import ThirdParty from 'supertokens-web-js/recipe/thirdparty';
import { initAuthClient } from '@/app/lib/authClient';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';

const GITHUB_THIRD_PARTY_ID = 'github';
const REDIRECT_STORAGE_KEY = 'yc_github_redirect_v1';
const DEFAULT_REDIRECT = '/developers/home';

/** True only when GitHub sign in is enabled for the frontend. */
export const isGithubSignInEnabled = (): boolean =>
  (process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED ?? '').trim() === 'true';

/** The callback URL SuperTokens returns to after the GitHub handshake. */
export const getRedirectUri = (): string => `${globalThis.location.origin}/auth/callback`;

/** Navigate the browser to the authorisation URL (kept here so callers can mock it). */
/* v8 ignore next 3 -- jsdom makes location.assign read-only; exercised via the button caller test */
export const redirectToUrl = (url: string): void => {
  globalThis.location.assign(url);
};

const persistRedirect = (redirectTo: string): void => {
  try {
    globalThis.sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectTo);
  } catch {
    /* private mode: the callback falls back to the default developer landing */
  }
};

/** Read (and clear) where to land after the callback; defaults to the developer home. */
export const consumeGithubRedirect = (): string => {
  try {
    const stored = globalThis.sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    globalThis.sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
    return stored || DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
};

/**
 * Builds the GitHub authorisation URL via SuperTokens, remembering where to land
 * after the callback. Returns null when the flow is unconfigured or the auth
 * client cannot initialise.
 */
export async function startGithubSignIn(redirectTo: string): Promise<string | null> {
  if (!isGithubSignInEnabled()) return null;
  if (!initAuthClient()) return null;
  persistRedirect(redirectTo);
  return ThirdParty.getAuthorisationURLWithQueryParamsAndSetState({
    thirdPartyId: GITHUB_THIRD_PARTY_ID,
    frontendRedirectURI: getRedirectUri(),
  });
}

export interface GithubCallbackResult {
  redirectTo: string;
}

/**
 * Completes the GitHub handshake on the callback route. SuperTokens reads the
 * authorization code + state from the URL and exchanges them via the backend.
 * Throws on any non-OK status so the callback page can surface a message.
 */
export async function completeGithubSignIn(): Promise<GithubCallbackResult> {
  if (!initAuthClient()) {
    throw new Error('We could not complete GitHub sign in. Please try again.');
  }
  const response = await ThirdParty.signInAndUp();
  if (response.status === 'NO_EMAIL_GIVEN_BY_PROVIDER') {
    throw new Error(
      'GitHub did not share an email for your account. Add a public email on GitHub, or use another sign-in method.'
    );
  }
  if (response.status === 'SIGN_IN_UP_NOT_ALLOWED') {
    throw new Error(response.reason);
  }
  // Drop any prior account's session-scoped caches so switching accounts via
  // GitHub does not leak the previous user's orgs/appointments/documents into
  // the new session - the email/password path clears these too.
  clearSessionScopedStores();
  return { redirectTo: consumeGithubRedirect() };
}
