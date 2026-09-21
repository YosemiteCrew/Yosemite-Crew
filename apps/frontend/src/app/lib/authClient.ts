import SuperTokens from 'supertokens-web-js';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import EmailVerification from 'supertokens-web-js/recipe/emailverification';
import MultiFactorAuth from 'supertokens-web-js/recipe/multifactorauth';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import ThirdParty from 'supertokens-web-js/recipe/thirdparty';
import TOTP from 'supertokens-web-js/recipe/totp';
import type { RecipeInterface as SessionRecipeInterface } from 'supertokens-web-js/recipe/session/types';

import { logger } from '@/app/lib/logger';

// SuperTokens serves its frontend-driver-interface routes from the API origin
// under this base path (configured on the backend).
const AUTH_API_BASE_PATH = '/auth';
const SESSION_WRITE_REPLAY_BLOCKED_STATUS = 460;
export const SESSION_WRITE_REPLAY_BLOCKED_HEADER = 'x-yc-session-write-replay-blocked';

const SAFE_REQUEST_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let initialized = false;

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string =>
  (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

const isAuthRequest = (input: RequestInfo | URL, apiDomain: string): boolean => {
  const url = input instanceof Request ? input.url : String(input);
  try {
    return new URL(url, globalThis.location.origin).href.startsWith(
      `${apiDomain}${AUTH_API_BASE_PATH}/`
    );
  } catch {
    return false;
  }
};

const restoreBlockedResponse = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set(SESSION_WRITE_REPLAY_BLOCKED_HEADER, 'true');
  return new Response(response.body, {
    status: 401,
    statusText: 'Unauthorized',
    headers,
  });
};

const sessionReplayGuard = (apiDomain: string) => ({
  functions: (originalImplementation: SessionRecipeInterface): SessionRecipeInterface => {
    const blockedResponses = new WeakSet<Response>();

    return {
      ...originalImplementation,
      addFetchInterceptorsAndReturnModifiedFetch: ({
        originalFetch,
        userContext,
      }: {
        originalFetch: typeof fetch;
        userContext: unknown;
      }) => {
        const guardedFetch: typeof fetch = async (input, init) => {
          const response = await originalFetch(input, init);
          if (
            response.status === 401 &&
            !SAFE_REQUEST_METHODS.has(requestMethod(input, init)) &&
            !isAuthRequest(input, apiDomain)
          ) {
            const blockedResponse = new Response(response.body, {
              status: SESSION_WRITE_REPLAY_BLOCKED_STATUS,
              statusText: response.statusText,
              headers: response.headers,
            });
            blockedResponses.add(blockedResponse);
            return blockedResponse;
          }
          return response;
        };
        const interceptedFetch = originalImplementation.addFetchInterceptorsAndReturnModifiedFetch({
          originalFetch: guardedFetch,
          userContext,
        });

        return async (input: RequestInfo | URL, init?: RequestInit) => {
          const response = await interceptedFetch(input, init);
          if (!blockedResponses.has(response)) return response;

          await Session.attemptRefreshingSession();
          return restoreBlockedResponse(response);
        };
      },
      // Product API traffic uses axios's fetch adapter below. Leaving the XHR
      // interceptor active would retain the SDK's method-blind write replay.
      addXMLHttpRequestInterceptor: () => {},
    };
  },
});

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
 * once, and never during SSR. Once initialized, the SDK installs the guarded
 * fetch interceptor that refreshes and retries safe reads while returning
 * expired writes to their caller for explicit resubmission.
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
      ThirdParty.init(),
      MultiFactorAuth.init(),
      TOTP.init(),
      Session.init({ override: sessionReplayGuard(apiDomain) }),
    ],
  });

  initialized = true;
  return true;
};
