/**
 * Turns a sign-in failure into something the person at the desk can act on.
 *
 * The catch in SignIn.tsx rendered `error.message` verbatim, so a rate-limited
 * bootstrap put "Request failed with status code 429" on screen under a generic
 * "Error" heading. That names a condition a veterinary receptionist has no way
 * to interpret, gives no indication of whether they did anything wrong, and
 * suggests no action - so the reasonable conclusion available to them is that
 * their password is wrong. It is not: authentication had already succeeded, and
 * only the profile call afterwards was throttled.
 */

/** Extracts an HTTP status from whatever shape the transport threw. */
export const statusOf = (error: unknown): number | undefined => {
  const candidate = error as
    | { status?: unknown; response?: { status?: unknown } }
    | null
    | undefined;
  const raw = candidate?.response?.status ?? candidate?.status;
  return typeof raw === 'number' ? raw : undefined;
};

export const DEFAULT_SIGN_IN_ERROR = 'Sign in failed. Please try again.';

export const signInErrorMessage = (error: unknown): string => {
  switch (statusOf(error)) {
    case 429:
      // Says what happened, that it is temporary, and what to do. Deliberately
      // does not blame the credentials, which were accepted.
      return 'Too many requests right now. Your sign in was accepted - please wait a minute and try again.';
    case 502:
    case 503:
    case 504:
      return 'The service is temporarily unavailable. Please wait a moment and try again.';
    default: {
      const message = (error as { message?: unknown } | null | undefined)?.message;
      // A transport string like "Request failed with status code 500" tells the
      // reader nothing, so it is replaced rather than shown. Anything the API
      // wrote for a human (a wrong-credentials message) is kept.
      if (typeof message !== 'string' || !message.trim()) return DEFAULT_SIGN_IN_ERROR;
      return /request failed with status code/i.test(message) ? DEFAULT_SIGN_IN_ERROR : message;
    }
  }
};
