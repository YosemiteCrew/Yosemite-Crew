import SuperTokens from 'supertokens-web-js';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import EmailVerification from 'supertokens-web-js/recipe/emailverification';
import MultiFactorAuth from 'supertokens-web-js/recipe/multifactorauth';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import TOTP from 'supertokens-web-js/recipe/totp';

import { logger } from '@/app/lib/logger';

jest.mock('supertokens-web-js', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

jest.mock('supertokens-web-js/recipe/emailpassword', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'emailpassword-recipe') },
}));

jest.mock('supertokens-web-js/recipe/emailverification', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'emailverification-recipe') },
}));

jest.mock('supertokens-web-js/recipe/multifactorauth', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'multifactorauth-recipe') },
}));

jest.mock('supertokens-web-js/recipe/passwordless', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'passwordless-recipe') },
}));

jest.mock('supertokens-web-js/recipe/session', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'session-recipe') },
}));

jest.mock('supertokens-web-js/recipe/totp', () => ({
  __esModule: true,
  default: { init: jest.fn(() => 'totp-recipe') },
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

type AuthClientModule = typeof import('@/app/lib/authClient');

const loadAuthClient = async (): Promise<AuthClientModule> => {
  let moduleRef: AuthClientModule | undefined;
  await jest.isolateModulesAsync(async () => {
    moduleRef = await import('@/app/lib/authClient');
  });
  return moduleRef as AuthClientModule;
};

describe('authClient', () => {
  const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com/';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
  });

  describe('resolveApiDomain', () => {
    it('strips paths and trailing slashes down to the origin', async () => {
      const { resolveApiDomain } = await loadAuthClient();
      expect(resolveApiDomain('https://api.example.com/some/path/')).toBe(
        'https://api.example.com'
      );
    });

    it('returns null for missing values', async () => {
      const { resolveApiDomain } = await loadAuthClient();
      expect(resolveApiDomain(undefined)).toBeNull();
      expect(resolveApiDomain('')).toBeNull();
    });

    it('returns null and warns for malformed URLs', async () => {
      const { resolveApiDomain } = await loadAuthClient();
      expect(resolveApiDomain('not a url')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid NEXT_PUBLIC_BASE_URL for auth client',
        expect.anything()
      );
    });
  });

  describe('initAuthClient', () => {
    it('initializes SuperTokens with the derived origin and every recipe', async () => {
      const { initAuthClient } = await loadAuthClient();

      expect(initAuthClient()).toBe(true);

      expect(SuperTokens.init).toHaveBeenCalledTimes(1);
      expect(SuperTokens.init).toHaveBeenCalledWith({
        appInfo: {
          appName: 'Yosemite Crew',
          apiDomain: 'https://api.example.com',
          apiBasePath: '/auth',
        },
        recipeList: [
          'emailpassword-recipe',
          'emailverification-recipe',
          'passwordless-recipe',
          'multifactorauth-recipe',
          'totp-recipe',
          'session-recipe',
        ],
      });
      expect(EmailPassword.init).toHaveBeenCalled();
      expect(EmailVerification.init).toHaveBeenCalled();
      expect(Passwordless.init).toHaveBeenCalled();
      expect(MultiFactorAuth.init).toHaveBeenCalled();
      expect(TOTP.init).toHaveBeenCalled();
      expect(Session.init).toHaveBeenCalled();
    });

    it('only initializes once', async () => {
      const { initAuthClient } = await loadAuthClient();

      expect(initAuthClient()).toBe(true);
      expect(initAuthClient()).toBe(true);

      expect(SuperTokens.init).toHaveBeenCalledTimes(1);
    });

    it('skips initialization when the base URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const { initAuthClient } = await loadAuthClient();

      expect(initAuthClient()).toBe(false);

      expect(SuperTokens.init).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Auth client not initialized: NEXT_PUBLIC_BASE_URL is missing or invalid'
      );
    });

    // The SSR guard (globalThis.window === undefined) cannot be exercised in
    // jsdom because the window property is non-configurable there.
  });
});
