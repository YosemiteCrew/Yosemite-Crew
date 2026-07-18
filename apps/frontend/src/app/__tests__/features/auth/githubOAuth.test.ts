import ThirdParty from 'supertokens-web-js/recipe/thirdparty';
import { initAuthClient } from '@/app/lib/authClient';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';
import {
  completeGithubSignIn,
  consumeGithubRedirect,
  getRedirectUri,
  isGithubSignInEnabled,
  startGithubSignIn,
} from '@/app/features/auth/lib/githubOAuth';

jest.mock('supertokens-web-js/recipe/thirdparty', () => ({
  __esModule: true,
  default: {
    getAuthorisationURLWithQueryParamsAndSetState: jest.fn(),
    signInAndUp: jest.fn(),
  },
}));

jest.mock('@/app/lib/authClient', () => ({
  initAuthClient: jest.fn(),
}));

jest.mock('@/app/lib/resetSessionStores', () => ({
  clearSessionScopedStores: jest.fn(),
}));

const getAuthorisationURL = ThirdParty.getAuthorisationURLWithQueryParamsAndSetState as jest.Mock;
const signInAndUp = ThirdParty.signInAndUp as jest.Mock;
const initAuthClientMock = initAuthClient as jest.Mock;
const clearSessionScopedStoresMock = clearSessionScopedStores as jest.Mock;

const REDIRECT_KEY = 'yc_github_redirect_v1';
const DEFAULT_REDIRECT = '/developers/home';

describe('githubOAuth', () => {
  const originalEnv = process.env;
  let realSessionStorage: Storage;

  const enable = () => {
    process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED = 'true';
  };

  const overrideSessionStorage = (partial: Partial<Storage>) => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        ...partial,
      },
    });
  };

  beforeAll(() => {
    realSessionStorage = globalThis.sessionStorage;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    sessionStorage.clear();
    // clearMocks wipes call history but not implementations; re-seed the happy
    // path each test so a prior test's override (e.g. initAuthClient -> false)
    // never leaks forward.
    initAuthClientMock.mockReturnValue(true);
    getAuthorisationURL.mockResolvedValue('https://api.example/auth/authorize?state=xyz');
    signInAndUp.mockResolvedValue({ status: 'OK' });
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: realSessionStorage,
    });
  });

  describe('isGithubSignInEnabled', () => {
    it('is disabled when the env flag is unset', () => {
      delete process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED;
      expect(isGithubSignInEnabled()).toBe(false);
    });

    it('is disabled when the env flag is not exactly "true"', () => {
      process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED = 'false';
      expect(isGithubSignInEnabled()).toBe(false);
    });

    it('is enabled when the env flag is "true", tolerating surrounding whitespace', () => {
      process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED = '  true  ';
      expect(isGithubSignInEnabled()).toBe(true);
    });
  });

  describe('getRedirectUri', () => {
    it('builds the callback URI from the current origin', () => {
      expect(getRedirectUri()).toBe(`${globalThis.location.origin}/auth/callback`);
      expect(getRedirectUri().endsWith('/auth/callback')).toBe(true);
    });
  });

  describe('startGithubSignIn', () => {
    it('returns null when GitHub sign in is disabled', async () => {
      delete process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED;
      await expect(startGithubSignIn('/developers/home')).resolves.toBeNull();
      expect(initAuthClientMock).not.toHaveBeenCalled();
      expect(getAuthorisationURL).not.toHaveBeenCalled();
    });

    it('returns null when the auth client cannot initialise', async () => {
      enable();
      initAuthClientMock.mockReturnValue(false);
      await expect(startGithubSignIn('/developers/home')).resolves.toBeNull();
      expect(getAuthorisationURL).not.toHaveBeenCalled();
    });

    it('persists the redirect target and returns the SuperTokens authorisation URL', async () => {
      enable();
      getAuthorisationURL.mockResolvedValue('https://api.example/auth/authorize?state=abc');
      const url = await startGithubSignIn('/developers/dashboard');
      expect(url).toBe('https://api.example/auth/authorize?state=abc');
      expect(getAuthorisationURL).toHaveBeenCalledWith({
        thirdPartyId: 'github',
        frontendRedirectURI: getRedirectUri(),
      });
      expect(sessionStorage.getItem(REDIRECT_KEY)).toBe('/developers/dashboard');
    });

    it('still returns a URL when sessionStorage.setItem is blocked (private mode)', async () => {
      enable();
      overrideSessionStorage({
        setItem: () => {
          throw new Error('private mode');
        },
      });
      getAuthorisationURL.mockResolvedValue('https://api.example/auth/authorize');
      await expect(startGithubSignIn('/x')).resolves.toBe('https://api.example/auth/authorize');
    });
  });

  describe('consumeGithubRedirect', () => {
    it('returns and clears the stored redirect target', () => {
      sessionStorage.setItem(REDIRECT_KEY, '/developers/keys');
      expect(consumeGithubRedirect()).toBe('/developers/keys');
      expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
    });

    it('falls back to the developer home when nothing is stored', () => {
      expect(consumeGithubRedirect()).toBe(DEFAULT_REDIRECT);
    });

    it('falls back to the developer home when sessionStorage.getItem throws', () => {
      overrideSessionStorage({
        getItem: () => {
          throw new Error('blocked');
        },
      });
      expect(consumeGithubRedirect()).toBe(DEFAULT_REDIRECT);
    });
  });

  describe('completeGithubSignIn', () => {
    it('throws when the auth client cannot initialise', async () => {
      initAuthClientMock.mockReturnValue(false);
      await expect(completeGithubSignIn()).rejects.toThrow(/could not complete github sign in/i);
      expect(signInAndUp).not.toHaveBeenCalled();
    });

    it('returns the stored redirect target on a successful handshake', async () => {
      sessionStorage.setItem(REDIRECT_KEY, '/developers/apps');
      signInAndUp.mockResolvedValue({ status: 'OK' });
      await expect(completeGithubSignIn()).resolves.toEqual({ redirectTo: '/developers/apps' });
      expect(signInAndUp).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
      // A successful sign in clears any prior account's session-scoped stores.
      expect(clearSessionScopedStoresMock).toHaveBeenCalledTimes(1);
    });

    it('defaults the redirect target when none was stored', async () => {
      signInAndUp.mockResolvedValue({ status: 'OK' });
      await expect(completeGithubSignIn()).resolves.toEqual({ redirectTo: DEFAULT_REDIRECT });
    });

    it('throws when GitHub shares no email for the account', async () => {
      signInAndUp.mockResolvedValue({ status: 'NO_EMAIL_GIVEN_BY_PROVIDER' });
      await expect(completeGithubSignIn()).rejects.toThrow(/did not share an email/i);
      // A failed handshake must not wipe the current session's stores.
      expect(clearSessionScopedStoresMock).not.toHaveBeenCalled();
    });

    it('throws the provider reason when sign in up is not allowed', async () => {
      signInAndUp.mockResolvedValue({
        status: 'SIGN_IN_UP_NOT_ALLOWED',
        reason: 'This account is not permitted to sign in.',
      });
      await expect(completeGithubSignIn()).rejects.toThrow(
        'This account is not permitted to sign in.'
      );
    });
  });
});
