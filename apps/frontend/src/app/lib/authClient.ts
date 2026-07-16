import SuperTokens from 'supertokens-web-js';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import EmailVerification from 'supertokens-web-js/recipe/emailverification';
import MultiFactorAuth from 'supertokens-web-js/recipe/multifactorauth';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import TOTP from 'supertokens-web-js/recipe/totp';

import { logger } from '@/app/lib/logger';

// SuperTokens serves its frontend-driver-interface routes from the API origin
// under this base path (configured on the backend).
const AUTH_API_BASE_PATH = '/auth';

let initialized = false;

/**
 * Derive the API origin from NEXT_PUBLIC_BASE_URL. The env var may include a
 * path or trailing slash (e.g. "https://api.example.com/"); SuperTokens wants
 * the bare origin.
 */
export const resolveApiDomain = (baseUrl: string | undefined): string | null => {
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch (error) {
    logger.warn('Invalid NEXT_PUBLIC_BASE_URL for auth client', error);
    return null;
  }
};

/**
 * Idempotent, browser-only SuperTokens SDK bootstrap. Safe to call from any
 * module that needs the SDK (session store, axios service) — it only runs
 * once, and never during SSR. Once initialized, the SDK also installs global
 * fetch/XHR interceptors that attach session cookies and transparently
 * refresh expired sessions.
 */
export const initAuthClient = (): boolean => {
  if (initialized) return true;
  if (globalThis.window === undefined) return false;

  const apiDomain = resolveApiDomain(process.env.NEXT_PUBLIC_BASE_URL);
  if (!apiDomain) {
    logger.warn('Auth client not initialized: NEXT_PUBLIC_BASE_URL is missing or invalid');
    return false;
  }

  SuperTokens.init({
    appInfo: {
      appName: 'Yosemite Crew',
      apiDomain,
      apiBasePath: AUTH_API_BASE_PATH,
    },
    recipeList: [
      EmailPassword.init(),
      EmailVerification.init(),
      Passwordless.init(),
      MultiFactorAuth.init(),
      TOTP.init(),
      Session.init(),
    ],
  });

  initialized = true;
  return true;
};
