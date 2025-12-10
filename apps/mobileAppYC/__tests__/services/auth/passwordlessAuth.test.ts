const mockSyncAuthUser = jest.fn();
jest.mock('@/features/auth/services/authUserService', () => ({
  syncAuthUser: (...args: any[]) => mockSyncAuthUser(...args),
}));

// Mock aws-amplify/auth
jest.mock('aws-amplify/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  confirmSignIn: jest.fn(),
  fetchAuthSession: jest.fn(),
  getCurrentUser: jest.fn(),
  fetchUserAttributes: jest.fn(),
  signOut: jest.fn(),
  AuthError: class AuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

import {
  requestPasswordlessEmailCode,
  completePasswordlessSignIn,
  signOutEverywhere,
  formatAuthError,
} from '@/features/auth/services/passwordlessAuth';

const AmplifyAuth = require('aws-amplify/auth');

describe('passwordlessAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockSyncAuthUser.mockResolvedValue({
      success: true,
      authUser: {
        _id: 'auth-user-id',
        authProvider: 'cognito',
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
    it('should successfully request code for new user', async () => {
      const email = 'test@example.com';

      (AmplifyAuth.signUp as jest.Mock).mockResolvedValue({
        isSignUpComplete: true,
        userId: 'user-123',
      });

      (AmplifyAuth.signIn as jest.Mock).mockResolvedValue({
        isSignedIn: false,
        nextStep: {
          signInStep: 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE',
        },
      });

      const result = await requestPasswordlessEmailCode(email);

      expect(result).toEqual({
        destination: 'test@example.com',
        isNewUser: true,
        challengeLength: 4,
        challengeType: 'otp',
        isDemoLogin: false,
        nextStep: {
          signInStep: 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE',
        },
      });

      expect(AmplifyAuth.signUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: expect.any(String),
        options: {
          userAttributes: {
            email: 'test@example.com',
            preferred_username: 'test@example.com',
          },
        },
      });

      expect(AmplifyAuth.signIn).toHaveBeenCalledWith({
        username: 'test@example.com',
        options: {
          authFlowType: 'CUSTOM_WITHOUT_SRP',
          clientMetadata: {
            loginEmail: 'test@example.com',
          },
        },
      });
    });

    it('should successfully request code for existing user', async () => {
      const email = 'existing@example.com';

      // Create an error that looks like AuthError with UsernameExistsException
      const existsError = Object.assign(new Error('User already exists'), {
        name: 'UsernameExistsException',
      });
      // Make it an instance of AuthError by setting the prototype
      Object.setPrototypeOf(existsError, AmplifyAuth.AuthError.prototype);

      (AmplifyAuth.signUp as jest.Mock).mockRejectedValue(existsError);

      (AmplifyAuth.signIn as jest.Mock).mockResolvedValue({
        isSignedIn: false,
        nextStep: {
          signInStep: 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE',
        },
      });

      const result = await requestPasswordlessEmailCode(email);

      expect(result).toEqual({
        destination: 'existing@example.com',
        isNewUser: false,
        challengeLength: 4,
        challengeType: 'otp',
        isDemoLogin: false,
        nextStep: {
          signInStep: 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE',
        },
      });
    });

    it('should normalize email to lowercase and trim', async () => {
      const email = '  Test@EXAMPLE.COM  ';

      (AmplifyAuth.signUp as jest.Mock).mockResolvedValue({});
      (AmplifyAuth.signIn as jest.Mock).mockResolvedValue({
        isSignedIn: false,
        nextStep: {signInStep: 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE'},
      });

      await requestPasswordlessEmailCode(email);

      expect(AmplifyAuth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'test@example.com',
        }),
      );
    });

    it('should handle signUp errors other than UsernameExists', async () => {
      const error = Object.assign(new Error('Invalid email'), {
        name: 'InvalidParameterException',
      });
      (AmplifyAuth.signUp as jest.Mock).mockRejectedValue(error);

      await expect(requestPasswordlessEmailCode('invalid')).rejects.toThrow(
        'The email address looks invalid. Please try again.',
      );
    });

    it('should handle signIn errors', async () => {
      const error = Object.assign(new Error('Not authorized'), {
        name: 'NotAuthorizedException',
      });

      (AmplifyAuth.signUp as jest.Mock).mockResolvedValue({});
      (AmplifyAuth.signIn as jest.Mock).mockRejectedValue(error);

      await expect(requestPasswordlessEmailCode('test@example.com')).rejects.toThrow();
    });
  });

  describe('completePasswordlessSignIn', () => {
    const mockSession = {
      tokens: {
        idToken: {
          toString: () => 'mock-id-token',
          payload: {exp: 1234567890},
        },
        accessToken: {
          toString: () => 'mock-access-token',
          payload: {exp: 1234567890},
        },
      },
    };

    const mockUser = {
      userId: 'user-123',
      username: 'test@example.com',
    };

    const mockAttributes = {
      email: 'test@example.com',
      sub: 'user-123',
    };

    const mockParentSummary = {
      id: 'parent-1',
      firstName: 'Parent',
      lastName: 'User',
      profileImageUrl: 'profile-token-123',
      isComplete: true,
    };
    const mockProfile = {
      exists: true,
      isComplete: true,
      profileToken: 'profile-token-123',
      source: 'remote' as const,
      parent: mockParentSummary,
    };

    it('should complete sign in successfully', async () => {
      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: true,
      });
      (AmplifyAuth.fetchAuthSession as jest.Mock).mockResolvedValue(mockSession);
      (AmplifyAuth.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (AmplifyAuth.fetchUserAttributes as jest.Mock).mockResolvedValue(mockAttributes);
      mockSyncAuthUser.mockResolvedValueOnce({
        success: true,
        authUser: {
          _id: 'auth-user-id',
          authProvider: 'cognito',
          providerUserId: 'user-123',
          email: 'test@example.com',
        },
        parentLinked: true,
        parentSummary: mockParentSummary,
      });

      const result = await completePasswordlessSignIn('123456');

      expect(result).toEqual({
        user: mockUser,
        attributes: mockAttributes,
        tokens: {
          idToken: 'mock-id-token',
          accessToken: 'mock-access-token',
          refreshToken: undefined,
          expiresAt: 1234567890000,
          userId: 'user-123',
          provider: 'amplify',
        },
        profile: mockProfile,
        parentLinked: true,
      });

      expect(AmplifyAuth.confirmSignIn).toHaveBeenCalledWith({
        challengeResponse: '123456',
      });
    });

    it('should throw error when not signed in after confirmation', async () => {
      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: false,
      });

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow();
    });

    it('should throw error when tokens are missing', async () => {
      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: true,
      });
      (AmplifyAuth.fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: null,
      });

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Authentication tokens are missing from the session.',
      );
    });

    it('should throw error when idToken is missing', async () => {
      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: true,
      });
      (AmplifyAuth.fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: null,
          accessToken: {toString: () => 'access-token'},
        },
      });

      await expect(completePasswordlessSignIn('123456')).rejects.toThrow(
        'Authentication tokens are missing from the session.',
      );
    });

    it('should handle profile fetch with user data', async () => {
      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: true,
      });
      (AmplifyAuth.fetchAuthSession as jest.Mock).mockResolvedValue(mockSession);
      (AmplifyAuth.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (AmplifyAuth.fetchUserAttributes as jest.Mock).mockResolvedValue(mockAttributes);
      mockSyncAuthUser.mockResolvedValueOnce({
        success: true,
        authUser: {
          _id: 'auth-user-id',
          authProvider: 'cognito',
          providerUserId: 'user-123',
          email: 'test@example.com',
        },
        parentLinked: false,
        parentSummary: mockParentSummary,
      });

      await completePasswordlessSignIn('123456');

      expect(mockSyncAuthUser).toHaveBeenCalledWith({
        authToken: 'mock-id-token',
        idToken: 'mock-id-token',
      });
    });

    it('should use username as fallback when email attribute is missing', async () => {
      const attributesWithoutEmail = {sub: 'user-123'};

      (AmplifyAuth.confirmSignIn as jest.Mock).mockResolvedValue({
        isSignedIn: true,
      });
      (AmplifyAuth.fetchAuthSession as jest.Mock).mockResolvedValue(mockSession);
      (AmplifyAuth.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (AmplifyAuth.fetchUserAttributes as jest.Mock).mockResolvedValue(attributesWithoutEmail);
      mockSyncAuthUser.mockResolvedValueOnce({
        success: true,
        authUser: {
          _id: 'auth-user-id',
          authProvider: 'cognito',
          providerUserId: 'user-123',
          email: 'user-123',
        },
        parentLinked: false,
        parentSummary: mockParentSummary,
      });

      await completePasswordlessSignIn('123456');

      expect(mockSyncAuthUser).toHaveBeenCalledWith({
        authToken: 'mock-id-token',
        idToken: 'mock-id-token',
      });
    });
  });

  describe('signOutEverywhere', () => {
    it('should sign out globally successfully', async () => {
      (AmplifyAuth.signOut as jest.Mock).mockResolvedValue(undefined);

      await signOutEverywhere();

      expect(AmplifyAuth.signOut).toHaveBeenCalledWith({global: true});
      expect(console.log).toHaveBeenCalledWith('[Amplify] Signed out globally');
    });

    it('should fallback to local sign out when global fails', async () => {
      (AmplifyAuth.signOut as jest.Mock)
        .mockRejectedValueOnce(new Error('Global sign out failed'))
        .mockResolvedValueOnce(undefined);

      await signOutEverywhere();

      expect(AmplifyAuth.signOut).toHaveBeenCalledWith({global: true});
      expect(AmplifyAuth.signOut).toHaveBeenCalledWith({global: false});
      expect(console.log).toHaveBeenCalledWith('[Amplify] Signed out locally');
    });

    it('should handle OAuth sign out exception gracefully', async () => {
      const oauthError = {name: 'OAuthSignOutException'};
      (AmplifyAuth.signOut as jest.Mock)
        .mockRejectedValueOnce(new Error('Global failed'))
        .mockRejectedValueOnce(oauthError);

      await expect(signOutEverywhere()).resolves.not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        '[Amplify] OAuth sign out error - user may have signed in with social provider',
      );
    });

    it('should throw error for non-OAuth local sign out failures', async () => {
      const error = new Error('Unknown error');
      (AmplifyAuth.signOut as jest.Mock)
        .mockRejectedValueOnce(new Error('Global failed'))
        .mockRejectedValueOnce(error);

      await expect(signOutEverywhere()).rejects.toThrow('Unknown error');
    });
  });

  describe('formatAuthError', () => {
    it('should format InvalidParameterException', () => {
      const error = Object.assign(new Error('Invalid parameter'), {
        name: 'InvalidParameterException',
      });
      expect(formatAuthError(error)).toBe(
        'The email address looks invalid. Please try again.',
      );
    });

    it('should format CodeMismatchException', () => {
      const error = Object.assign(new Error('Code mismatch'), {
        name: 'CodeMismatchException',
      });
      expect(formatAuthError(error)).toBe(
        'The code you entered is incorrect. Please try again.',
      );
    });

    it('should format NotAuthorizedException', () => {
      const error = Object.assign(new Error('Not authorized'), {
        name: 'NotAuthorizedException',
      });
      expect(formatAuthError(error)).toBe(
        'The code you entered is incorrect. Please try again.',
      );
    });

    it('should format ExpiredCodeException', () => {
      const error = Object.assign(new Error('Code expired'), {
        name: 'ExpiredCodeException',
      });
      expect(formatAuthError(error)).toBe(
        'The code has expired. Request a new one to continue.',
      );
    });

    it('should format message containing "code mismatch"', () => {
      const error = Object.assign(new Error('The code mismatch occurred'), {
        name: 'SomeException',
      });
      expect(formatAuthError(error)).toBe(
        'The code you entered is incorrect. Please try again.',
      );
    });

    it('should format message containing "expired"', () => {
      const error = Object.assign(new Error('Your code has expired'), {
        name: 'SomeException',
      });
      expect(formatAuthError(error)).toBe(
        'The code has expired. Request a new one to continue.',
      );
    });

    it('should return error message for unknown error names', () => {
      const error = Object.assign(new Error('Something went wrong'), {
        name: 'UnknownError',
      });
      expect(formatAuthError(error)).toBe('Something went wrong');
    });

    it('should handle regular Error objects', () => {
      const error = new Error('Regular error');
      expect(formatAuthError(error)).toBe('Regular error');
    });

    it('should handle unknown error types', () => {
      expect(formatAuthError('string error')).toBe(
        'Unexpected authentication error. Please retry.',
      );
    });

    it('should handle null/undefined errors', () => {
      expect(formatAuthError(null)).toBe(
        'Unexpected authentication error. Please retry.',
      );
    });
  });
});
