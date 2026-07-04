/**
 * "Continue with GitHub" for developers, via Cognito Hosted UI federation.
 *
 * The browser never sees a client secret. We redirect to the Cognito Hosted UI
 * `/oauth2/authorize` endpoint with `identity_provider=<GitHub IdP>` and PKCE;
 * Cognito performs the GitHub OAuth handshake and redirects back to
 * `/auth/callback` with an authorization code, which we exchange for tokens at
 * `/oauth2/token` (public client + PKCE, no secret). See the setup guide at
 * docs/auth/github-signin.md for the one-time GitHub + Cognito configuration.
 *
 * The flow is inert until NEXT_PUBLIC_COGNITO_DOMAIN + NEXT_PUBLIC_COGNITO_CLIENTID
 * are set, so the button never appears half-wired.
 */

const STORAGE_KEY = 'yc_github_oauth_v1';
const DEFAULT_IDP = 'GitHub';
const SCOPES = 'openid email profile';

const clientId = (process.env.NEXT_PUBLIC_COGNITO_CLIENTID ?? '').trim();
const idpName = (process.env.NEXT_PUBLIC_COGNITO_GITHUB_IDP ?? '').trim() || DEFAULT_IDP;

/** Cognito Hosted UI origin (accepts a bare host or a full URL); '' when unset. */
const domainOrigin = ((): string => {
  const raw = (process.env.NEXT_PUBLIC_COGNITO_DOMAIN ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin;
  } catch {
    return '';
  }
})();

/** True only when the Hosted UI domain and client id are configured. */
export const isGithubSignInEnabled = (): boolean => Boolean(domainOrigin && clientId);

/** The OAuth redirect target registered in the Cognito app client's callback URLs. */
export const getRedirectUri = (): string => `${globalThis.location.origin}/auth/callback`;

/** Navigate the browser to the Cognito authorize URL (kept here so callers can mock it). */
/* v8 ignore next 3 -- jsdom makes location.assign read-only; exercised via the button caller test */
export const redirectToUrl = (url: string): void => {
  globalThis.location.assign(url);
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const randomToken = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};

const sha256Base64Url = async (input: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
};

interface StoredHandshake {
  verifier: string;
  state: string;
  redirectTo: string;
}

const readHandshake = (): StoredHandshake | null => {
  try {
    const raw = globalThis.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredHandshake) : null;
  } catch {
    return null;
  }
};

/**
 * Builds the Cognito Hosted UI authorize URL for GitHub, persisting the PKCE
 * verifier + CSRF state for the callback. Returns null when the flow is unconfigured.
 */
export async function startGithubSignIn(redirectTo: string): Promise<string | null> {
  if (!isGithubSignInEnabled()) return null;

  const verifier = randomToken(48);
  const state = randomToken(16);
  const codeChallenge = await sha256Base64Url(verifier);

  try {
    globalThis.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ verifier, state, redirectTo } satisfies StoredHandshake)
    );
  } catch {
    /* private mode: state validation below will fail closed */
  }

  const params = new URLSearchParams({
    identity_provider: idpName,
    client_id: clientId,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${domainOrigin}/oauth2/authorize?${params.toString()}`;
}

export interface FederatedTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface GithubCallbackResult {
  tokens: FederatedTokens;
  redirectTo: string;
}

/**
 * Validates the CSRF state and exchanges the authorization code for tokens using
 * the stored PKCE verifier. Throws on any mismatch or a failed exchange.
 */
export async function completeGithubSignIn(params: {
  code: string;
  state: string;
}): Promise<GithubCallbackResult> {
  const stored = readHandshake();
  if (!stored?.state || stored.state !== params.state) {
    throw new Error('This sign-in link is invalid or has expired. Please try again.');
  }
  try {
    globalThis.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: params.code,
    redirect_uri: getRedirectUri(),
    code_verifier: stored.verifier,
  });

  const response = await fetch(`${domainOrigin}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error('We could not complete GitHub sign in. Please try again.');
  }

  const json = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!json.id_token || !json.access_token || !json.refresh_token) {
    throw new Error('GitHub sign in returned an incomplete response.');
  }

  return {
    tokens: {
      idToken: json.id_token,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
    },
    redirectTo: stored.redirectTo || '/developers/home',
  };
}
