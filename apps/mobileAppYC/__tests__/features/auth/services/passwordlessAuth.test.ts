const mockSyncAuthUser = jest.fn();
jest.mock('@/features/auth/services/authUserService', () => ({
  syncAuthUser: (...args: any[]) => mockSyncAuthUser(...args),
}));

jest.mock('supertokens-react-native', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    signOut: jest.fn(),
    doesSessionExist: jest.fn(),
    getAccessToken: jest.fn(),
    getUserId: jest.fn(),
    attemptRefreshingSession: jest.fn(),
    addAxiosInterceptors: jest.fn(),
  },
}));

jest.mock('@/config/variables', () => ({
  API_CONFIG: {baseUrl: 'https://api.test', timeoutMs: 15000},
  AUTH_FEATURE_FLAGS: {enableReviewLogin: true},
  DEMO_LOGIN_CONFIG: {email: 'demo@example.com', password: 'test-review-pass'},
  DEVELOPMENT_API_BASE_URL: 'https://devapi.test',
}));

import {
  requestPasswordlessEmailCode,
  completePasswordlessSignIn,
  signOutEverywhere,
  formatAuthError,
  __resetPasswordlessStateForTesting,
} from '@/features/auth/services/passwordlessAuth';
import {__resetSuperTokensInitForTesting} from '@/features/auth/services/superTokensClient';
import SuperTokens from 'supertokens-react-native';

const mockSuperTokens = SuperTokens as jest.Mocked<typeof SuperTokens> & {
  init: jest.Mock;
  signOut: jest.Mock;
  doesSessionExist: jest.Mock;
  getAccessToken: jest.Mock;
  getUserId: jest.Mock;
};

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const okCreateCodeBody = {
  status: 'OK',
  deviceId: 'device-1',
  preAuthSessionId: 'pre-auth-1',
  flowType: 'USER_INPUT_CODE',
};

const okConsumeBody = {
  status: 'OK',
  createdNewRecipeUser: false,
  user: {id: 'user-123', emails: ['test@example.com']},
};

const mockFetch = jest.fn();

describe('passwordlessAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPasswordlessStateForTesting();
    __resetSuperTokensInitForTesting();
    (global as any).fetch = mockFetch;
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockSuperTokens.getAccessToken.mockResolvedValue('st-access-token');
    mockSuperTokens.getUserId.mockResolvedValue('user-123');
    mockSuperTokens.signOut.mockResolvedValue(undefined);
    mockSyncAuthUser.mockResolvedValue({
      success: true,
      authUser: {
        _id: 'auth-user-id',
        authProvider: 'supertokens',
        providerUserId: 'user-123',
        email: 'test@example.com',
      },
      parentLinked: false,
      parentSummary: undefined,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestPasswordlessEmailCode', () => {
    it('creates an OTP device via the SuperTokens FDI endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(okCreateCodeBody));

      const result = await requestPasswordlessEmailCode('test@example.com');

      expect(result).toEqual({
        destination: 'test@example.com',
        isNewUser: false,
        challengeType: 'otp',
        challengeLength: 6,
        isDemoLogin: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/auth/signinup/code',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            rid: 'passwordless',
          }),
          body: JSON.stringify({email: 'test@example.com'}),
        }),
      );

      expect(mockSuperTokens.init).toHaveBeenCalledWith({
        apiDomain: 'https://api.test',
        apiBasePath: '/auth',
        tokenTransferMethod: 'header',
      });
    });

    it('normalizes email to lowercase and trims', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(okCreateCodeBody));

      const result = await requestPasswordlessEmailCode('  Test@EXAMPLE.COM  ');

      expect(result.destination).toBe('test@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({email: 'test@example.com'}),
        }),
      );
    });

    it('routes the demo/review login to the dev backend', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(okCreateCodeBody));

      const result = await requestPasswordlessEmailCode('demo@example.com');

      expect(result).toEqual({
        destination: 'demo@example.com',
        isNewUser: false,
        challengeType: 'demoPassword',
        challengeLength: 'test-review-pass'.length,
        isDemoLogin: true,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://devapi.test/auth/signinup/code',
        expect.any(Object),
      );
      expect(mockSuperTokens.init).toHaveBeenCalledWith(
        expect.objectContaining({apiDomain: 'https://devapi.test'}),
      );
    });

    it('surfaces backend GENERAL_ERROR messages', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'GENERAL_ERROR', message: 'Email is blocked'}),
      );

      await expect(
        requestPasswordlessEmailCode('test@example.com'),
      ).rejects.toThrow('Email is blocked');
    });

    it('maps SIGN_IN_UP_NOT_ALLOWED to the reason message', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'SIGN_IN_UP_NOT_ALLOWED',
          reason: 'Sign ups are disabled.',
        }),
      );

      await expect(
        requestPasswordlessEmailCode('test@example.com'),
      ).rejects.toThrow('Sign ups are disabled.');
    });

    it('falls back to a generic error for unparseable failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('bad json');
        },
      });

      await expect(
        requestPasswordlessEmailCode('test@example.com'),
      ).rejects.toThrow('Unexpected authentication error. Please retry.');
    });
  });

  describe('completePasswordlessSignIn', () => {
    const requestCode = async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(okCreateCodeBody));
      await requestPasswordlessEmailCode('test@example.com');
      mockFetch.mockClear();
    };

    it('consumes the OTP and establishes a session', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(makeResponse(okConsumeBody));
      mockSyncAuthUser.mockResolvedValueOnce({
        success: true,
        authUser: {
          _id: 'auth-user-id',
          authProvider: 'supertokens',
          providerUserId: 'user-123',
          email: 'test@example.com',
        },
        parentLinked: true,
        parentSummary: {
          id: 'parent-1',
          firstName: 'Parent',
          lastName: 'User',
          profileImageUrl: 'profile-token-123',
          isComplete: true,
        },
      });

      const result = await completePasswordlessSignIn('123456');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/auth/signinup/code/consume',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({rid: 'passwordless'}),
          body: JSON.stringify({
            preAuthSessionId: 'pre-auth-1',
            deviceId: 'device-1',
            userInputCode: '123456',
          }),
        }),
      );

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        isNewUser: false,
        tokens: {
          idToken: 'st-access-token',
          accessToken: 'st-access-token',
          refreshToken: undefined,
          expiresAt: undefined,
          userId: 'user-123',
          provider: 'supertokens',
        },
        profile: {
          exists: true,
          isComplete: true,
          profileToken: 'profile-token-123',
          source: 'remote',
          parent: {
            id: 'parent-1',
            firstName: 'Parent',
            lastName: 'User',
            profileImageUrl: 'profile-token-123',
            isComplete: true,
          },
        },
        parentLinked: true,
      });

      expect(mockSyncAuthUser).toHaveBeenCalledWith({
        authToken: 'st-access-token',
      });
    });

    it('reports new users from createdNewUser/createdNewRecipeUser', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({...okConsumeBody, createdNewRecipeUser: true}),
      );

      const result = await completePasswordlessSignIn('123456');

      expect(result.isNewUser).toBe(true);
    });

    it('falls back to the requested email when the response has none', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'OK',
          createdNewUser: false,
          user: {id: 'user-123'},
        }),
      );

      const result = await completePasswordlessSignIn('123456');

      expect(result.email).toBe('test@example.com');
    });

    it('throws the restart-flow message when no code was requested', async () => {
      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Too many failed attempts. Please request a new code.',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('maps INCORRECT_USER_INPUT_CODE_ERROR to the incorrect-code message', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'INCORRECT_USER_INPUT_CODE_ERROR',
          failedCodeInputAttemptCount: 1,
          maximumCodeInputAttempts: 5,
        }),
      );

      await expect(completePasswordlessSignIn('000000')).rejects.toThrow(
        'The code you entered is incorrect. Please try again.',
      );
    });

    it('maps EXPIRED_USER_INPUT_CODE_ERROR to the expired-code message', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'EXPIRED_USER_INPUT_CODE_ERROR'}),
      );

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'The code has expired. Request a new one to continue.',
      );
    });

    it('maps RESTART_FLOW_ERROR and requires a new code afterwards', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'RESTART_FLOW_ERROR'}),
      );

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Too many failed attempts. Please request a new code.',
      );

      // Device state cleared — a retry without a fresh code is rejected locally.
      mockFetch.mockClear();
      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Too many failed attempts. Please request a new code.',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws when the SDK exposes no access token after consume', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(makeResponse(okConsumeBody));
      mockSuperTokens.getAccessToken.mockResolvedValueOnce(undefined);

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Authentication tokens are missing from the session.',
      );
    });

    it('resolves the user id from the SDK when missing in the response', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'OK', user: {emails: ['test@example.com']}}),
      );
      mockSuperTokens.getUserId.mockResolvedValueOnce('sdk-user-9');

      const result = await completePasswordlessSignIn('123456');

      expect(result.userId).toBe('sdk-user-9');
    });

    it('completes with a default profile when auth sync fails', async () => {
      await requestCode();
      mockFetch.mockResolvedValueOnce(makeResponse(okConsumeBody));
      mockSyncAuthUser.mockRejectedValueOnce(new Error('sync failed'));

      const result = await completePasswordlessSignIn('123456');

      expect(result.profile).toEqual({
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'remote',
      });
      expect(result.parentLinked).toBe(false);
    });
  });

  describe('signOutEverywhere', () => {
    it('signs out via the SuperTokens SDK', async () => {
      await signOutEverywhere();

      expect(mockSuperTokens.signOut).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('[SuperTokens] Signed out');
    });

    it('warns without throwing when sign out fails', async () => {
      mockSuperTokens.signOut.mockRejectedValueOnce(new Error('offline'));

      await expect(signOutEverywhere()).resolves.not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        '[SuperTokens] Sign out failed:',
        expect.any(Error),
      );
    });
  });

  describe('formatAuthError', () => {
    it('returns messages from Error instances', () => {
      expect(formatAuthError(new Error('Regular error'))).toBe('Regular error');
    });

    it('maps INCORRECT_USER_INPUT_CODE_ERROR payloads', () => {
      expect(formatAuthError({status: 'INCORRECT_USER_INPUT_CODE_ERROR'})).toBe(
        'The code you entered is incorrect. Please try again.',
      );
    });

    it('maps EXPIRED_USER_INPUT_CODE_ERROR payloads', () => {
      expect(formatAuthError({status: 'EXPIRED_USER_INPUT_CODE_ERROR'})).toBe(
        'The code has expired. Request a new one to continue.',
      );
    });

    it('maps RESTART_FLOW_ERROR payloads', () => {
      expect(formatAuthError({status: 'RESTART_FLOW_ERROR'})).toBe(
        'Too many failed attempts. Please request a new code.',
      );
    });

    it('maps messages containing "expired"', () => {
      expect(formatAuthError({message: 'Your code has expired'})).toBe(
        'The code has expired. Request a new one to continue.',
      );
    });

    it('passes through other backend messages', () => {
      expect(formatAuthError({message: 'Something went wrong'})).toBe(
        'Something went wrong',
      );
    });

    it('handles unknown error types', () => {
      expect(formatAuthError('string error')).toBe(
        'Unexpected authentication error. Please retry.',
      );
    });

    it('handles null/undefined errors', () => {
      expect(formatAuthError(null)).toBe(
        'Unexpected authentication error. Please retry.',
      );
    });
  });
});
