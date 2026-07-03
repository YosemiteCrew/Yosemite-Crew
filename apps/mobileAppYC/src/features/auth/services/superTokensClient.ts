import SuperTokens from 'supertokens-react-native';
import {API_CONFIG} from '@/config/variables';

/**
 * SuperTokens FDI base path exposed by the backend on this branch.
 * OTP:     POST {API}/auth/signinup/code + /code/consume
 * Social:  POST {API}/auth/signinup
 * Refresh: POST {API}/auth/session/refresh (handled by the SDK)
 */
export const SUPERTOKENS_API_BASE_PATH = '/auth';

let initializedApiDomain: string | null = null;

/**
 * Initializes the SuperTokens React Native SDK against the given API domain.
 * The SDK intercepts global fetch, attaches the session tokens via headers,
 * and transparently refreshes the access token when it expires.
 *
 * Safe to call repeatedly — re-initialization only happens when the API
 * domain changes (e.g. demo login switching to the dev backend).
 */
export const initSuperTokens = (apiDomain: string): void => {
  if (!apiDomain || initializedApiDomain === apiDomain) {
    return;
  }

  SuperTokens.init({
    apiDomain,
    apiBasePath: SUPERTOKENS_API_BASE_PATH,
    tokenTransferMethod: 'header',
  });
  initializedApiDomain = apiDomain;
};

/**
 * Builds an absolute URL for a SuperTokens FDI endpoint using the runtime
 * API base URL unless an explicit base is provided.
 */
export const resolveAuthEndpoint = (path: string, apiBase?: string): string => {
  const base = (apiBase ?? API_CONFIG.baseUrl).replace(/\/$/, '');
  return `${base}${SUPERTOKENS_API_BASE_PATH}${path}`;
};

export const __resetSuperTokensInitForTesting = (): void => {
  initializedApiDomain = null;
};
