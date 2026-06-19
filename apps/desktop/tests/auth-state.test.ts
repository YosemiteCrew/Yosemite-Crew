import { isAuthenticatedPath, authStateForUrl, reduceAuth } from '../src/utils/auth-state';

describe('isAuthenticatedPath', () => {
  test('treats the marketing/auth routes as signed-out', () => {
    expect(isAuthenticatedPath('/')).toBe(false);
    expect(isAuthenticatedPath('/signin')).toBe(false);
    expect(isAuthenticatedPath('/signup')).toBe(false);
    expect(isAuthenticatedPath('/forgot-password')).toBe(false);
    expect(isAuthenticatedPath('/pricing')).toBe(false);
    expect(isAuthenticatedPath('/developers/home')).toBe(false);
    expect(isAuthenticatedPath('')).toBe(false);
  });

  test('treats in-app routes as authenticated', () => {
    expect(isAuthenticatedPath('/dashboard')).toBe(true);
    expect(isAuthenticatedPath('/appointments/123')).toBe(true);
    expect(isAuthenticatedPath('/inbox')).toBe(true);
  });

  test('ignores trailing slashes and case', () => {
    expect(isAuthenticatedPath('/SignIn/')).toBe(false);
    expect(isAuthenticatedPath('/Dashboard/')).toBe(true);
  });

  test('treats slash-only paths as signed-out', () => {
    expect(isAuthenticatedPath('//')).toBe(false);
    expect(isAuthenticatedPath('///')).toBe(false);
  });
});

describe('authStateForUrl', () => {
  test('derives state from the URL path', () => {
    expect(authStateForUrl('https://yosemitecrew.com/signin')).toBe('signed-out');
    expect(authStateForUrl('https://yosemitecrew.com/dashboard')).toBe('signed-in');
    expect(authStateForUrl('not a url')).toBe('signed-out');
  });
});

describe('reduceAuth', () => {
  test('flags the signed-out -> signed-in transition exactly once', () => {
    const first = reduceAuth('signed-out', 'https://yosemitecrew.com/dashboard');
    expect(first).toEqual({ state: 'signed-in', justSignedIn: true });

    const second = reduceAuth('signed-in', 'https://yosemitecrew.com/appointments');
    expect(second).toEqual({ state: 'signed-in', justSignedIn: false });
  });

  test('does not flag staying or returning to signed-out', () => {
    expect(reduceAuth('signed-out', 'https://yosemitecrew.com/signin')).toEqual({
      state: 'signed-out',
      justSignedIn: false,
    });
    expect(reduceAuth('signed-in', 'https://yosemitecrew.com/signin')).toEqual({
      state: 'signed-out',
      justSignedIn: false,
    });
  });
});
