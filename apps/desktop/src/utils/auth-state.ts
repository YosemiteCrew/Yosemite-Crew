'use strict';

// Heuristic auth-state detection for the wrapped PIMS web app. The shell can't
// read the site's session directly (it's a remote origin), so it infers sign-in
// from navigation: landing on an in-app route means the user is authenticated,
// while the public marketing/auth pages mean they are not. Pure + unit tested.

export type AuthState = 'signed-out' | 'signed-in';

// Public (pre-authentication) routes on the PIMS site. Anything outside these is
// treated as the authenticated application.
export const PUBLIC_PATH_PREFIXES: readonly string[] = Object.freeze([
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/verify-email',
  '/pricing',
  '/contact-us',
  '/about-us',
  '/developers',
  '/dev-docs',
  '/pet-businesses',
  '/pet-parents',
]);

export const isAuthenticatedPath = (pathname: string): boolean => {
  if (!pathname || pathname === '/') return false;
  // Strip trailing slashes without a regex; `/\/+$/` is flagged as ReDoS-prone.
  const lower = pathname.toLowerCase();
  let end = lower.length;
  while (end > 0 && lower[end - 1] === '/') end--;
  const p = lower.slice(0, end) || '/';
  if (p === '/') return false;
  return !PUBLIC_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
};

export const authStateForUrl = (rawUrl: string): AuthState => {
  try {
    return isAuthenticatedPath(new URL(rawUrl).pathname) ? 'signed-in' : 'signed-out';
  } catch {
    return 'signed-out';
  }
};

// Reduce a navigation into the next auth state, flagging the signed-out → signed-in
// transition so the shell can confirm the login exactly once.
export const reduceAuth = (
  prev: AuthState,
  rawUrl: string
): { state: AuthState; justSignedIn: boolean } => {
  const state = authStateForUrl(rawUrl);
  return {
    state,
    justSignedIn: prev === 'signed-out' && state === 'signed-in',
  };
};
