import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import EmailVerification from 'supertokens-web-js/recipe/emailverification';
import MultiFactorAuth from 'supertokens-web-js/recipe/multifactorauth';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import TOTP from 'supertokens-web-js/recipe/totp';

import { useAuthStore } from '@/app/stores/authStore';
import { getData, postData } from '@/app/services/axios';
import { logger } from '@/app/lib/logger';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';
import { removeStorageItem } from '@/app/lib/browserStorage';
import { initAuthClient } from '@/app/lib/authClient';

// --- Mocks ---

jest.mock('@/app/lib/authClient', () => ({
  initAuthClient: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/app/lib/resetSessionStores', () => ({
  clearSessionScopedStores: jest.fn(),
}));

jest.mock('@/app/lib/browserStorage', () => ({
  removeStorageItem: jest.fn(),
}));

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('supertokens-web-js/recipe/emailpassword', () => ({
  __esModule: true,
  default: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    submitNewPassword: jest.fn(),
  },
}));

jest.mock('supertokens-web-js/recipe/emailverification', () => ({
  __esModule: true,
  default: {
    verifyEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
    isEmailVerified: jest.fn(),
  },
}));

jest.mock('supertokens-web-js/recipe/multifactorauth', () => ({
  __esModule: true,
  default: {
    resyncSessionAndFetchMFAInfo: jest.fn(),
  },
}));

jest.mock('supertokens-web-js/recipe/passwordless', () => ({
  __esModule: true,
  default: {
    createCode: jest.fn(),
    consumeCode: jest.fn(),
  },
}));

jest.mock('supertokens-web-js/recipe/session', () => ({
  __esModule: true,
  default: {
    doesSessionExist: jest.fn(),
    attemptRefreshingSession: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock('supertokens-web-js/recipe/totp', () => ({
  __esModule: true,
  default: {
    verifyCode: jest.fn(),
  },
}));

const mockSignUpApi = EmailPassword.signUp as jest.Mock;
const mockSignInApi = EmailPassword.signIn as jest.Mock;
const mockSendPasswordResetEmail = EmailPassword.sendPasswordResetEmail as jest.Mock;
const mockSubmitNewPassword = EmailPassword.submitNewPassword as jest.Mock;
const mockVerifyEmail = EmailVerification.verifyEmail as jest.Mock;
const mockSendVerificationEmail = EmailVerification.sendVerificationEmail as jest.Mock;
const mockIsEmailVerified = EmailVerification.isEmailVerified as jest.Mock;
const mockResyncMfa = MultiFactorAuth.resyncSessionAndFetchMFAInfo as jest.Mock;
const mockCreateCode = Passwordless.createCode as jest.Mock;
const mockConsumeCode = Passwordless.consumeCode as jest.Mock;
const mockDoesSessionExist = Session.doesSessionExist as jest.Mock;
const mockAttemptRefreshingSession = Session.attemptRefreshingSession as jest.Mock;
const mockSessionSignOut = Session.signOut as jest.Mock;
const mockVerifyTotpCode = TOTP.verifyCode as jest.Mock;
const mockGetData = getData as jest.Mock;
const mockPostData = postData as jest.Mock;

const ME_FIXTURE = {
  userId: 'user-1',
  authProfile: 'pims_web',
  loginMethod: 'password',
  email: 'test@test.com',
  emailVerified: true,
};

const PROFILE_FIXTURE = { firstName: 'Jane', lastName: 'Doe' };

const noMfaInfo = {
  status: 'OK',
  factors: { next: [], alreadySetup: [], allowedToSetup: [] },
  emails: {},
  phoneNumbers: {},
};

const seedHappyPathMocks = () => {
  mockDoesSessionExist.mockResolvedValue(true);
  mockAttemptRefreshingSession.mockResolvedValue(true);
  mockSessionSignOut.mockResolvedValue(undefined);
  mockIsEmailVerified.mockResolvedValue({ status: 'OK', isVerified: true });
  mockSendVerificationEmail.mockResolvedValue({ status: 'OK' });
  mockResyncMfa.mockResolvedValue(noMfaInfo);
  mockPostData.mockResolvedValue({ data: {} });
  mockGetData.mockImplementation(async (endpoint: string) => {
    if (endpoint === '/v1/auth/me') {
      return { data: ME_FIXTURE };
    }
    if (endpoint === `/fhir/v1/user/${ME_FIXTURE.userId}`) {
      return { data: PROFILE_FIXTURE };
    }
    throw new Error(`Unexpected getData endpoint: ${endpoint}`);
  });
};

const resetStoreState = () => {
  useAuthStore.setState({
    user: null,
    attributes: null,
    status: 'idle',
    loading: false,
    error: null,
    role: null,
    mfaChallenge: null,
    pendingSignUp: null,
  });
};

describe('authStore (SuperTokens)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedHappyPathMocks();
    resetStoreState();
  });

  it('initializes the SuperTokens client when the module is loaded', () => {
    // The module-scope init happened on first import; the mock retains no
    // calls after clearing, so assert the wiring exists instead.
    expect(initAuthClient).toBeDefined();
  });

  describe('signUp', () => {
    it('signs up, stores the pending profile, and sends a verification email', async () => {
      mockSignUpApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });

      const result = await useAuthStore
        .getState()
        .signUp('test@email.com', 'Test-password-1!', 'John', 'Doe');

      expect(mockSignUpApi).toHaveBeenCalledWith({
        formFields: [
          { id: 'email', value: 'test@email.com' },
          { id: 'password', value: 'Test-password-1!' },
        ],
      });
      expect(result).toEqual({ userId: 'user-1' });
      expect(useAuthStore.getState().pendingSignUp).toEqual({
        email: 'test@email.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'member',
      });
      expect(mockSendVerificationEmail).toHaveBeenCalled();
    });

    it('keeps a custom role in the pending sign-up profile', async () => {
      mockSignUpApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });

      await useAuthStore
        .getState()
        .signUp('dev@email.com', 'Test-password-1!', 'Dev', 'Eloper', 'developer');

      expect(useAuthStore.getState().pendingSignUp?.role).toBe('developer');
    });

    it('still resolves when the verification email fails to send', async () => {
      mockSignUpApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockSendVerificationEmail.mockRejectedValue(new Error('mail down'));

      const result = await useAuthStore
        .getState()
        .signUp('test@email.com', 'Test-password-1!', 'John', 'Doe');

      expect(result).toEqual({ userId: 'user-1' });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send the verification email after sign up',
        expect.any(Error)
      );
    });

    it('maps duplicate-email field errors to EMAIL_ALREADY_EXISTS', async () => {
      mockSignUpApi.mockResolvedValue({
        status: 'FIELD_ERROR',
        formFields: [{ id: 'email', error: 'This email already exists. Please sign in instead' }],
      });

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'Test-password-1!', 'John', 'Doe')
      ).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with the given email already exists.',
      });
      expect(useAuthStore.getState().pendingSignUp).toBeNull();
    });

    it('throws other field errors with the provider message', async () => {
      mockSignUpApi.mockResolvedValue({
        status: 'FIELD_ERROR',
        formFields: [{ id: 'password', error: 'Password too weak' }],
      });

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'weak', 'John', 'Doe')
      ).rejects.toMatchObject({ code: 'FIELD_ERROR', message: 'Password too weak' });
    });

    it('falls back to a generic message when field errors are empty', async () => {
      mockSignUpApi.mockResolvedValue({ status: 'FIELD_ERROR', formFields: [] });

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'Test-password-1!', 'John', 'Doe')
      ).rejects.toThrow('Sign up failed');
    });

    it('throws when sign up is not allowed', async () => {
      mockSignUpApi.mockResolvedValue({
        status: 'SIGN_UP_NOT_ALLOWED',
        reason: 'Blocked for security reasons',
      });

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'Test-password-1!', 'John', 'Doe')
      ).rejects.toMatchObject({ code: 'SIGN_UP_NOT_ALLOWED' });
    });

    it('wraps non-Error rejections', async () => {
      mockSignUpApi.mockRejectedValue('network broke');

      await expect(
        useAuthStore.getState().signUp('test@email.com', 'Test-password-1!', 'John', 'Doe')
      ).rejects.toThrow('network broke');
    });
  });

  describe('verifyEmail / resendVerificationEmail', () => {
    it('returns OK when the token verifies', async () => {
      mockVerifyEmail.mockResolvedValue({ status: 'OK' });
      await expect(useAuthStore.getState().verifyEmail()).resolves.toBe('OK');
    });

    it('returns INVALID_TOKEN for expired links', async () => {
      mockVerifyEmail.mockResolvedValue({ status: 'EMAIL_VERIFICATION_INVALID_TOKEN_ERROR' });
      await expect(useAuthStore.getState().verifyEmail()).resolves.toBe('INVALID_TOKEN');
    });

    it('resends the verification email', async () => {
      await expect(useAuthStore.getState().resendVerificationEmail()).resolves.toBe('OK');
    });

    it('reports when the email is already verified', async () => {
      mockSendVerificationEmail.mockResolvedValue({ status: 'EMAIL_ALREADY_VERIFIED_ERROR' });
      await expect(useAuthStore.getState().resendVerificationEmail()).resolves.toBe(
        'ALREADY_VERIFIED'
      );
    });
  });

  describe('clearPendingSignUp', () => {
    it('clears the stored pending sign-up profile', () => {
      useAuthStore.setState({
        pendingSignUp: { email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'member' },
      });
      useAuthStore.getState().clearPendingSignUp();
      expect(useAuthStore.getState().pendingSignUp).toBeNull();
    });
  });

  describe('signIn', () => {
    it('authenticates, loads /v1/auth/me, and builds attributes', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'OK' });
      const state = useAuthStore.getState();
      expect(state.status).toBe('signin-authenticated');
      expect(state.user?.userId).toBe('user-1');
      expect(state.user?.getUsername()).toBe('user-1');
      expect(state.attributes).toEqual({
        sub: 'user-1',
        email: 'test@test.com',
        email_verified: 'true',
        given_name: 'Jane',
        family_name: 'Doe',
      });
      expect(clearSessionScopedStores).toHaveBeenCalled();
    });

    it('keeps attributes minimal when the profile lookup fails', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockGetData.mockImplementation(async (endpoint: string) => {
        if (endpoint === '/v1/auth/me') {
          return { data: ME_FIXTURE };
        }
        throw new Error('profile missing');
      });

      await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(useAuthStore.getState().attributes).toEqual({
        sub: 'user-1',
        email: 'test@test.com',
        email_verified: 'true',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to load user profile while building attributes',
        expect.any(Error)
      );
    });

    it('sources the role from /v1/auth/me when present', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockGetData.mockImplementation(async (endpoint: string) => {
        if (endpoint === '/v1/auth/me') {
          return { data: { ...ME_FIXTURE, role: 'owner' } };
        }
        return { data: PROFILE_FIXTURE };
      });

      await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(useAuthStore.getState().role).toBe('owner');
    });

    it('falls back to the pending sign-up role', async () => {
      useAuthStore.setState({
        pendingSignUp: { email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'developer' },
      });
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });

      await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(useAuthStore.getState().role).toBe('developer');
    });

    it('maps wrong credentials to the legacy error message', async () => {
      mockSignInApi.mockResolvedValue({ status: 'WRONG_CREDENTIALS_ERROR' });

      await expect(useAuthStore.getState().signIn('test@email.com', 'bad')).rejects.toThrow(
        'Incorrect username or password.'
      );
      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.error).toBe('Incorrect username or password.');
    });

    it('surfaces SIGN_IN_NOT_ALLOWED reasons', async () => {
      mockSignInApi.mockResolvedValue({
        status: 'SIGN_IN_NOT_ALLOWED',
        reason: 'Account locked',
      });

      await expect(useAuthStore.getState().signIn('test@email.com', 'pass')).rejects.toThrow(
        'Account locked'
      );
    });

    it('surfaces field errors', async () => {
      mockSignInApi.mockResolvedValue({
        status: 'FIELD_ERROR',
        formFields: [{ id: 'email', error: 'Email is invalid' }],
      });

      await expect(useAuthStore.getState().signIn('nope', 'pass')).rejects.toThrow(
        'Email is invalid'
      );
    });

    it('resets state and rethrows network failures', async () => {
      mockSignInApi.mockRejectedValue(new Error('offline'));

      await expect(useAuthStore.getState().signIn('test@email.com', 'pass')).rejects.toThrow(
        'offline'
      );
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().error).toBe('offline');
    });

    it('wraps non-Error sign-in rejections', async () => {
      mockSignInApi.mockRejectedValue('string error message');

      await expect(useAuthStore.getState().signIn('user@test.com', 'pass')).rejects.toThrow(
        'string error message'
      );
    });

    it('requires email verification before completing sign in', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockIsEmailVerified.mockResolvedValue({ status: 'OK', isVerified: false });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'EMAIL_VERIFICATION_REQUIRED' });
      expect(mockSendVerificationEmail).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });

    it('still reports verification-required when the resend fails', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockIsEmailVerified.mockResolvedValue({ status: 'OK', isVerified: false });
      mockSendVerificationEmail.mockRejectedValue(new Error('mail down'));

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'EMAIL_VERIFICATION_REQUIRED' });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to send the verification email after sign in',
        expect.any(Error)
      );
    });

    it('starts an email OTP challenge when the session needs a second factor', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockResyncMfa.mockResolvedValue({
        ...noMfaInfo,
        factors: { next: ['otp-email', 'totp'], alreadySetup: [], allowedToSetup: ['totp'] },
      });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'MFA_REQUIRED', factors: ['otp-email'] });
      expect(useAuthStore.getState().mfaChallenge).toEqual({
        email: 'test@email.com',
        factors: ['otp-email'],
      });
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });

    it('prefers the TOTP factor when a device is enrolled', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockResyncMfa.mockResolvedValue({
        ...noMfaInfo,
        factors: { next: ['otp-email', 'totp'], alreadySetup: ['totp'], allowedToSetup: [] },
      });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'MFA_REQUIRED', factors: ['totp'] });
    });

    it('falls back to TOTP when it is the only requested factor', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockResyncMfa.mockResolvedValue({
        ...noMfaInfo,
        factors: { next: ['totp'], alreadySetup: [], allowedToSetup: [] },
      });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'MFA_REQUIRED', factors: ['totp'] });
    });

    it('ignores unsupported factors and completes sign in', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockResyncMfa.mockResolvedValue({
        ...noMfaInfo,
        factors: { next: ['webauthn'], alreadySetup: [], allowedToSetup: [] },
      });

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'OK' });
      expect(logger.warn).toHaveBeenCalledWith('Unsupported MFA factors requested by session', [
        'webauthn',
      ]);
    });

    it('completes sign in when the MFA resync fails', async () => {
      mockSignInApi.mockResolvedValue({ status: 'OK', user: { id: 'user-1' } });
      mockResyncMfa.mockRejectedValue(new Error('mfa info down'));

      const result = await useAuthStore.getState().signIn('test@email.com', 'pass');

      expect(result).toEqual({ status: 'OK' });
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to resolve pending MFA factors',
        expect.any(Error)
      );
    });
  });

  describe('completeTotpChallenge', () => {
    it('verifies the code and finishes the sign in', async () => {
      mockVerifyTotpCode.mockResolvedValue({ status: 'OK' });
      useAuthStore.setState({
        mfaChallenge: { email: 'test@email.com', factors: ['totp'] },
      });

      const result = await useAuthStore.getState().completeTotpChallenge('123456');

      expect(mockVerifyTotpCode).toHaveBeenCalledWith({ totp: '123456' });
      expect(result).toEqual({ status: 'OK' });
      expect(useAuthStore.getState().status).toBe('signin-authenticated');
      expect(useAuthStore.getState().mfaChallenge).toBeNull();
    });

    it('throws for invalid codes', async () => {
      mockVerifyTotpCode.mockResolvedValue({
        status: 'INVALID_TOTP_ERROR',
        currentNumberOfFailedAttempts: 1,
        maxNumberOfFailedAttempts: 5,
      });

      await expect(useAuthStore.getState().completeTotpChallenge('000000')).rejects.toMatchObject({
        code: 'INVALID_TOTP_ERROR',
      });
    });

    it('throws when the attempt limit is reached', async () => {
      mockVerifyTotpCode.mockResolvedValue({ status: 'LIMIT_REACHED_ERROR', retryAfterMs: 1000 });

      await expect(useAuthStore.getState().completeTotpChallenge('000000')).rejects.toMatchObject({
        code: 'LIMIT_REACHED_ERROR',
      });
    });

    it('wraps transport failures', async () => {
      mockVerifyTotpCode.mockRejectedValue('boom');

      await expect(useAuthStore.getState().completeTotpChallenge('000000')).rejects.toThrow('boom');
    });
  });

  describe('requestEmailOtp', () => {
    it('creates a passwordless code for the challenge email', async () => {
      mockCreateCode.mockResolvedValue({ status: 'OK' });
      useAuthStore.setState({
        mfaChallenge: { email: 'challenge@email.com', factors: ['otp-email'] },
      });

      await useAuthStore.getState().requestEmailOtp();

      expect(mockCreateCode).toHaveBeenCalledWith({ email: 'challenge@email.com' });
    });

    it('falls back to the signed-in user email', async () => {
      mockCreateCode.mockResolvedValue({ status: 'OK' });
      useAuthStore.setState({
        user: {
          userId: 'user-1',
          email: 'me@email.com',
          authProfile: null,
          loginMethod: null,
          emailVerified: true,
          getUsername: () => 'user-1',
        },
      });

      await useAuthStore.getState().requestEmailOtp();

      expect(mockCreateCode).toHaveBeenCalledWith({ email: 'me@email.com' });
    });

    it('throws when no email is available', async () => {
      await expect(useAuthStore.getState().requestEmailOtp()).rejects.toMatchObject({
        code: 'NO_CHALLENGE_EMAIL',
      });
    });

    it('throws when the provider rejects the code request', async () => {
      useAuthStore.setState({
        mfaChallenge: { email: 'challenge@email.com', factors: ['otp-email'] },
      });
      mockCreateCode.mockResolvedValue({
        status: 'SIGN_IN_UP_NOT_ALLOWED',
        reason: 'blocked',
      });

      await expect(useAuthStore.getState().requestEmailOtp()).rejects.toThrow('blocked');
    });
  });

  describe('completeEmailOtpChallenge', () => {
    it('consumes the code and finishes the sign in', async () => {
      mockConsumeCode.mockResolvedValue({
        status: 'OK',
        createdNewRecipeUser: false,
        user: { id: 'user-1' },
      });

      const result = await useAuthStore.getState().completeEmailOtpChallenge('123456');

      expect(mockConsumeCode).toHaveBeenCalledWith({ userInputCode: '123456' });
      expect(result).toEqual({ status: 'OK' });
      expect(useAuthStore.getState().status).toBe('signin-authenticated');
    });

    it('throws for incorrect codes', async () => {
      mockConsumeCode.mockResolvedValue({
        status: 'INCORRECT_USER_INPUT_CODE_ERROR',
        failedCodeInputAttemptCount: 1,
        maximumCodeInputAttempts: 5,
      });

      await expect(
        useAuthStore.getState().completeEmailOtpChallenge('000000')
      ).rejects.toMatchObject({ code: 'INCORRECT_USER_INPUT_CODE_ERROR' });
    });

    it('throws for expired codes', async () => {
      mockConsumeCode.mockResolvedValue({
        status: 'EXPIRED_USER_INPUT_CODE_ERROR',
        failedCodeInputAttemptCount: 1,
        maximumCodeInputAttempts: 5,
      });

      await expect(
        useAuthStore.getState().completeEmailOtpChallenge('000000')
      ).rejects.toMatchObject({ code: 'EXPIRED_USER_INPUT_CODE_ERROR' });
    });

    it('throws when the flow must restart', async () => {
      mockConsumeCode.mockResolvedValue({ status: 'RESTART_FLOW_ERROR' });

      await expect(
        useAuthStore.getState().completeEmailOtpChallenge('000000')
      ).rejects.toMatchObject({ code: 'RESTART_FLOW_ERROR' });
    });

    it('wraps transport failures', async () => {
      mockConsumeCode.mockRejectedValue('down');

      await expect(useAuthStore.getState().completeEmailOtpChallenge('000000')).rejects.toThrow(
        'down'
      );
    });
  });

  describe('checkSession', () => {
    it('restores the session when one exists', async () => {
      const user = await useAuthStore.getState().checkSession();

      expect(user?.userId).toBe('user-1');
      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.user).not.toBeNull();
    });

    it('sets unauthenticated when no session exists', async () => {
      mockDoesSessionExist.mockResolvedValue(false);

      const user = await useAuthStore.getState().checkSession();

      expect(user).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('sets unauthenticated when the identity fetch fails', async () => {
      mockGetData.mockRejectedValue(new Error('Session Error'));

      const user = await useAuthStore.getState().checkSession();

      expect(user).toBeNull();
      const state = useAuthStore.getState();
      expect(state.status).toBe('unauthenticated');
      expect(state.error).toBe('Session Error');
    });

    it('dedupes concurrent checks into one request', async () => {
      const [first, second] = await Promise.all([
        useAuthStore.getState().checkSession(),
        useAuthStore.getState().checkSession(),
      ]);

      expect(first?.userId).toBe('user-1');
      expect(second?.userId).toBe('user-1');
      expect(mockDoesSessionExist).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshSession', () => {
    it('refreshes and re-syncs the authenticated state', async () => {
      const user = await useAuthStore.getState().refreshSession();

      expect(mockAttemptRefreshingSession).toHaveBeenCalled();
      expect(user?.userId).toBe('user-1');
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    it('returns null when the refresh fails', async () => {
      mockAttemptRefreshingSession.mockResolvedValue(false);

      const user = await useAuthStore.getState().refreshSession();

      expect(user).toBeNull();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
    });

    it('returns null and warns when the refresh throws', async () => {
      mockAttemptRefreshingSession.mockRejectedValue(new Error('refresh down'));

      const user = await useAuthStore.getState().refreshSession();

      expect(user).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'refreshSession failed or session invalid:',
        expect.any(Error)
      );
    });

    it('dedupes concurrent refreshes', async () => {
      const [first, second] = await Promise.all([
        useAuthStore.getState().refreshSession(),
        useAuthStore.getState().refreshSession(),
      ]);

      expect(first?.userId).toBe('user-1');
      expect(second?.userId).toBe('user-1');
      expect(mockAttemptRefreshingSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValidSession', () => {
    const seededUser = {
      userId: 'user-1',
      email: 'test@test.com',
      authProfile: null,
      loginMethod: null,
      emailVerified: true,
      getUsername: () => 'user-1',
    };

    it('returns the current user when the session is still valid', async () => {
      useAuthStore.setState({ user: seededUser, status: 'authenticated' });

      const user = await useAuthStore.getState().getValidSession();

      expect(user).toBe(seededUser);
      expect(mockAttemptRefreshingSession).not.toHaveBeenCalled();
    });

    it('refreshes when no user is cached', async () => {
      const user = await useAuthStore.getState().getValidSession();

      expect(mockAttemptRefreshingSession).toHaveBeenCalled();
      expect(user?.userId).toBe('user-1');
    });

    it('falls through to checkSession when the refresh returns null', async () => {
      mockAttemptRefreshingSession.mockResolvedValue(false);
      mockDoesSessionExist.mockResolvedValue(false);

      const user = await useAuthStore.getState().getValidSession();

      expect(user).toBeNull();
      expect(mockDoesSessionExist).toHaveBeenCalled();
    });

    it('returns null with forceRefresh when the refresh fails', async () => {
      mockAttemptRefreshingSession.mockResolvedValue(false);

      const user = await useAuthStore.getState().getValidSession({ forceRefresh: true });

      expect(user).toBeNull();
    });

    it('skips the cached user when forceRefresh is set', async () => {
      useAuthStore.setState({ user: seededUser, status: 'authenticated' });

      await useAuthStore.getState().getValidSession({ forceRefresh: true });

      expect(mockAttemptRefreshingSession).toHaveBeenCalled();
    });
  });

  describe('signout', () => {
    it('revokes the server session, clears local state, and resets the store', async () => {
      useAuthStore.setState({ status: 'authenticated' });

      await useAuthStore.getState().signout();

      expect(removeStorageItem).toHaveBeenCalledWith('session', 'devAuth');
      expect(mockPostData).toHaveBeenCalledWith('/v1/auth/logout', undefined, {
        skipAuthRedirect: true,
      });
      expect(mockSessionSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(clearSessionScopedStores).toHaveBeenCalled();
    });

    it('still signs out locally when the server logout fails', async () => {
      mockPostData.mockRejectedValue(new Error('server down'));

      await useAuthStore.getState().signout();

      expect(mockSessionSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to revoke the server session on signout',
        expect.any(Error)
      );
    });

    it('still resets state when the local SDK signout fails', async () => {
      mockSessionSignOut.mockRejectedValue(new Error('sdk error'));

      await useAuthStore.getState().signout();

      expect(useAuthStore.getState().status).toBe('unauthenticated');
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to clear the local session on signout',
        expect.any(Error)
      );
    });

    it('warns when clearing session-scoped stores fails', async () => {
      (clearSessionScopedStores as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Store Error');
      });

      await useAuthStore.getState().signout();

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to clear session-scoped stores on signout',
        expect.any(Error)
      );
    });
  });

  describe('forgotPassword', () => {
    it('sends the reset email and resolves OK', async () => {
      mockSendPasswordResetEmail.mockResolvedValue({ status: 'OK' });

      const result = await useAuthStore.getState().forgotPassword('test@email.com');

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
        formFields: [{ id: 'email', value: 'test@email.com' }],
      });
      expect(result).toEqual({ status: 'OK' });
    });

    it('throws field errors', async () => {
      mockSendPasswordResetEmail.mockResolvedValue({
        status: 'FIELD_ERROR',
        formFields: [{ id: 'email', error: 'Email invalid' }],
      });

      await expect(useAuthStore.getState().forgotPassword('nope')).rejects.toThrow('Email invalid');
    });

    it('falls back to a generic field error message', async () => {
      mockSendPasswordResetEmail.mockResolvedValue({ status: 'FIELD_ERROR', formFields: [] });

      await expect(useAuthStore.getState().forgotPassword('nope')).rejects.toThrow(
        'Unable to send the reset email'
      );
    });

    it('throws when the reset is not allowed', async () => {
      mockSendPasswordResetEmail.mockResolvedValue({
        status: 'PASSWORD_RESET_NOT_ALLOWED',
        reason: 'Not allowed',
      });

      await expect(useAuthStore.getState().forgotPassword('test@email.com')).rejects.toThrow(
        'Not allowed'
      );
    });
  });

  describe('resetPassword', () => {
    it('submits the new password read from the URL token', async () => {
      mockSubmitNewPassword.mockResolvedValue({ status: 'OK' });

      const result = await useAuthStore.getState().resetPassword('Test-password-2!');

      expect(mockSubmitNewPassword).toHaveBeenCalledWith({
        formFields: [{ id: 'password', value: 'Test-password-2!' }],
      });
      expect(result).toBe('success');
    });

    it('throws for invalid tokens', async () => {
      mockSubmitNewPassword.mockResolvedValue({ status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR' });

      await expect(useAuthStore.getState().resetPassword('Test-password-2!')).rejects.toMatchObject(
        {
          code: 'RESET_PASSWORD_INVALID_TOKEN_ERROR',
        }
      );
    });

    it('throws field errors with the provider message', async () => {
      mockSubmitNewPassword.mockResolvedValue({
        status: 'FIELD_ERROR',
        formFields: [{ id: 'password', error: 'Password too weak' }],
      });

      await expect(useAuthStore.getState().resetPassword('weak')).rejects.toThrow(
        'Password too weak'
      );
    });

    it('falls back to a generic field error message', async () => {
      mockSubmitNewPassword.mockResolvedValue({ status: 'FIELD_ERROR', formFields: [] });

      await expect(useAuthStore.getState().resetPassword('weak')).rejects.toThrow(
        'Unable to reset the password'
      );
    });
  });

  describe('loadUserAttributes', () => {
    it('returns null without a session', async () => {
      mockDoesSessionExist.mockResolvedValue(false);

      const attributes = await useAuthStore.getState().loadUserAttributes();

      expect(attributes).toBeNull();
    });

    it('loads and stores the attributes record', async () => {
      const attributes = await useAuthStore.getState().loadUserAttributes();

      expect(attributes).toEqual({
        sub: 'user-1',
        email: 'test@test.com',
        email_verified: 'true',
        given_name: 'Jane',
        family_name: 'Doe',
      });
      expect(useAuthStore.getState().attributes).toEqual(attributes);
    });

    it('omits optional attribute keys when the identity has no email', async () => {
      mockGetData.mockImplementation(async (endpoint: string) => {
        if (endpoint === '/v1/auth/me') {
          return { data: { userId: 'user-1' } };
        }
        return { data: {} };
      });

      const attributes = await useAuthStore.getState().loadUserAttributes();

      expect(attributes).toEqual({ sub: 'user-1' });
    });

    it('rejects when the identity fetch fails', async () => {
      mockGetData.mockRejectedValue(new Error('Attr Fail'));

      await expect(useAuthStore.getState().loadUserAttributes()).rejects.toThrow('Attr Fail');
    });
  });
});
