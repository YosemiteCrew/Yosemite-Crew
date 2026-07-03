import { create } from 'zustand';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import EmailVerification from 'supertokens-web-js/recipe/emailverification';
import MultiFactorAuth from 'supertokens-web-js/recipe/multifactorauth';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import TOTP from 'supertokens-web-js/recipe/totp';

import { initAuthClient } from '@/app/lib/authClient';
import { removeStorageItem } from '@/app/lib/browserStorage';
import { logger } from '@/app/lib/logger';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';
import { getData, postData } from '@/app/services/axios';

// Bootstrap the SuperTokens SDK as soon as the auth store is loaded in the
// browser (no-op during SSR and when already initialized).
initAuthClient();

type Status = 'idle' | 'checking' | 'authenticated' | 'unauthenticated' | 'signin-authenticated';

export type MfaFactorId = 'totp' | 'otp-email';

export type MfaChallenge = {
  email: string;
  factors: MfaFactorId[];
};

export type AuthUser = {
  userId: string;
  email: string;
  authProfile: string | null;
  loginMethod: string | null;
  emailVerified: boolean;
  /** Compat accessor: several services read the auth user id through this. */
  getUsername: () => string;
};

export type SignInResult =
  | { status: 'OK' }
  | { status: 'EMAIL_VERIFICATION_REQUIRED' }
  | { status: 'MFA_REQUIRED'; factors: MfaFactorId[] };

export type PendingSignUp = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type AuthError = Error & { code: string };

type AuthMeResponse = {
  userId: string;
  authProfile?: string | null;
  loginMethod?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  role?: string | null;
};

type UserProfileResponse = {
  firstName?: string;
  lastName?: string;
};

type AuthStore = {
  user: AuthUser | null;
  attributes: Record<string, string> | null;
  status: Status;
  loading: boolean;
  error: string | null;
  role: string | null;
  mfaChallenge: MfaChallenge | null;
  pendingSignUp: PendingSignUp | null;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: string
  ) => Promise<{ userId: string } | undefined>;
  verifyEmail: () => Promise<'OK' | 'INVALID_TOKEN'>;
  resendVerificationEmail: () => Promise<'OK' | 'ALREADY_VERIFIED'>;
  clearPendingSignUp: () => void;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  completeTotpChallenge: (code: string) => Promise<{ status: 'OK' }>;
  requestEmailOtp: () => Promise<void>;
  completeEmailOtpChallenge: (code: string) => Promise<{ status: 'OK' }>;
  checkSession: () => Promise<AuthUser | null>;
  refreshSession: () => Promise<AuthUser | null>;
  getValidSession: (opts?: { forceRefresh?: boolean }) => Promise<AuthUser | null>;
  signout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ status: 'OK' } | null>;
  resetPassword: (newPassword: string) => Promise<string | null>;
  loadUserAttributes: () => Promise<Record<string, string> | null>;
};

let checkSessionPromise: Promise<AuthUser | null> | null = null;
let refreshSessionPromise: Promise<AuthUser | null> | null = null;

const makeAuthError = (message: string, code: string): AuthError => {
  const error = new Error(message) as AuthError;
  error.code = code;
  return error;
};

const emailPasswordFormFields = (email: string, password: string) => [
  { id: 'email', value: email },
  { id: 'password', value: password },
];

const toAuthUser = (me: AuthMeResponse): AuthUser => ({
  userId: me.userId,
  email: me.email ?? '',
  authProfile: me.authProfile ?? null,
  loginMethod: me.loginMethod ?? null,
  emailVerified: me.emailVerified ?? false,
  getUsername: () => me.userId,
});

const fetchMe = async (): Promise<AuthMeResponse> => {
  const response = await getData<AuthMeResponse>(
    '/v1/auth/me',
    {},
    { dedupe: false, suppressStatuses: [401, 403] }
  );
  return response.data;
};

/**
 * Build the attributes record consumers rely on. `sub` is the app user id;
 * `given_name`/`family_name` come from the provisioned user profile when it
 * exists (fresh sign-ups are not provisioned yet — that is not an error).
 */
const applyUserAttributes = async (
  set: (partial: Partial<AuthStore>) => void,
  me: AuthMeResponse
): Promise<Record<string, string>> => {
  const mapped: Record<string, string> = { sub: me.userId };
  if (me.email) {
    mapped.email = me.email;
  }
  if (me.emailVerified !== undefined) {
    mapped.email_verified = String(me.emailVerified);
  }
  try {
    const profile = await getData<UserProfileResponse>(
      `/fhir/v1/user/${me.userId}`,
      {},
      { suppressStatuses: [404] }
    );
    if (profile.data?.firstName) {
      mapped.given_name = profile.data.firstName;
    }
    if (profile.data?.lastName) {
      mapped.family_name = profile.data.lastName;
    }
  } catch (error) {
    logger.warn('Failed to load user profile while building attributes', error);
  }
  set({ attributes: mapped });
  return mapped;
};

const syncAuthenticatedState = async (
  set: (partial: Partial<AuthStore>) => void,
  get: () => AuthStore,
  status: Status
): Promise<AuthUser> => {
  const me = await fetchMe();
  const user = toAuthUser(me);
  set({
    user,
    loading: false,
    error: null,
    role: me.role ?? get().pendingSignUp?.role ?? null,
    status,
    mfaChallenge: null,
  });
  try {
    await applyUserAttributes(set, me);
  } catch (e) {
    logger.error('Failed to load user attributes', e);
  }
  return user;
};

/**
 * After the password factor succeeds, ask SuperTokens which second factors
 * (if any) the session still needs. Staff must complete TOTP when enrolled,
 * otherwise the email OTP factor.
 */
const resolvePendingMfaFactors = async (): Promise<MfaFactorId[]> => {
  const info = await MultiFactorAuth.resyncSessionAndFetchMFAInfo();
  const next = info.factors.next;
  if (next.length === 0) {
    return [];
  }
  if (next.includes('totp') && info.factors.alreadySetup.includes('totp')) {
    return ['totp'];
  }
  if (next.includes('otp-email')) {
    return ['otp-email'];
  }
  if (next.includes('totp')) {
    return ['totp'];
  }
  logger.warn('Unsupported MFA factors requested by session', next);
  return [];
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  attributes: null,
  status: 'idle',
  loading: false,
  error: null,
  role: null,
  mfaChallenge: null,
  pendingSignUp: null,

  signUp: async (email, password, firstName, lastName, role = 'member') => {
    set({ loading: true, error: null });
    try {
      const response = await EmailPassword.signUp({
        formFields: emailPasswordFormFields(email, password),
      });
      if (response.status === 'FIELD_ERROR') {
        const emailError = response.formFields.find((field) => field.id === 'email');
        if (emailError && /already exists/i.test(emailError.error)) {
          throw makeAuthError(
            'An account with the given email already exists.',
            'EMAIL_ALREADY_EXISTS'
          );
        }
        throw makeAuthError(response.formFields[0]?.error ?? 'Sign up failed', 'FIELD_ERROR');
      }
      if (response.status === 'SIGN_UP_NOT_ALLOWED') {
        throw makeAuthError(response.reason, 'SIGN_UP_NOT_ALLOWED');
      }
      set({ loading: false, pendingSignUp: { email, firstName, lastName, role } });
      try {
        await EmailVerification.sendVerificationEmail();
      } catch (error) {
        logger.warn('Failed to send the verification email after sign up', error);
      }
      return { userId: response.user.id };
    } catch (error) {
      set({ loading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  verifyEmail: async () => {
    const response = await EmailVerification.verifyEmail();
    if (response.status === 'EMAIL_VERIFICATION_INVALID_TOKEN_ERROR') {
      return 'INVALID_TOKEN';
    }
    return 'OK';
  },

  resendVerificationEmail: async () => {
    const response = await EmailVerification.sendVerificationEmail();
    if (response.status === 'EMAIL_ALREADY_VERIFIED_ERROR') {
      return 'ALREADY_VERIFIED';
    }
    return 'OK';
  },

  clearPendingSignUp: () => {
    set({ pendingSignUp: null });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null, status: 'checking' });
    let response;
    try {
      response = await EmailPassword.signIn({
        formFields: emailPasswordFormFields(email, password),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      set({
        loading: false,
        error: message,
        user: null,
        role: null,
        status: 'unauthenticated',
        attributes: null,
      });
      throw error instanceof Error ? error : new Error(String(error));
    }

    if (response.status !== 'OK') {
      let failure: AuthError;
      if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        failure = makeAuthError('Incorrect username or password.', 'WRONG_CREDENTIALS_ERROR');
      } else if (response.status === 'SIGN_IN_NOT_ALLOWED') {
        failure = makeAuthError(response.reason, 'SIGN_IN_NOT_ALLOWED');
      } else {
        failure = makeAuthError(
          response.formFields[0]?.error ?? 'Authentication failed',
          'FIELD_ERROR'
        );
      }
      set({
        loading: false,
        error: failure.message,
        user: null,
        role: null,
        status: 'unauthenticated',
        attributes: null,
      });
      throw failure;
    }

    clearSessionScopedStores();

    const verification = await EmailVerification.isEmailVerified();
    if (!verification.isVerified) {
      try {
        await EmailVerification.sendVerificationEmail();
      } catch (error) {
        logger.warn('Failed to send the verification email after sign in', error);
      }
      set({ loading: false, status: 'unauthenticated', mfaChallenge: null });
      return { status: 'EMAIL_VERIFICATION_REQUIRED' };
    }

    let factors: MfaFactorId[] = [];
    try {
      factors = await resolvePendingMfaFactors();
    } catch (error) {
      logger.warn('Failed to resolve pending MFA factors', error);
    }
    if (factors.length > 0) {
      set({ loading: false, status: 'unauthenticated', mfaChallenge: { email, factors } });
      return { status: 'MFA_REQUIRED', factors };
    }

    await syncAuthenticatedState(set, get, 'signin-authenticated');
    return { status: 'OK' };
  },

  completeTotpChallenge: async (code) => {
    set({ loading: true, error: null });
    let response;
    try {
      response = await TOTP.verifyCode({ totp: code });
    } catch (error) {
      set({ loading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (response.status === 'INVALID_TOTP_ERROR') {
      set({ loading: false });
      throw makeAuthError('Invalid code. Please try again.', 'INVALID_TOTP_ERROR');
    }
    if (response.status === 'LIMIT_REACHED_ERROR') {
      set({ loading: false });
      throw makeAuthError('Too many attempts. Please try again later.', 'LIMIT_REACHED_ERROR');
    }
    await syncAuthenticatedState(set, get, 'signin-authenticated');
    return { status: 'OK' as const };
  },

  requestEmailOtp: async () => {
    const email = get().mfaChallenge?.email ?? get().user?.email;
    if (!email) {
      throw makeAuthError('No email available for the OTP challenge.', 'NO_CHALLENGE_EMAIL');
    }
    const response = await Passwordless.createCode({ email });
    if (response.status !== 'OK') {
      throw makeAuthError(response.reason, response.status);
    }
  },

  completeEmailOtpChallenge: async (code) => {
    set({ loading: true, error: null });
    let response;
    try {
      response = await Passwordless.consumeCode({ userInputCode: code });
    } catch (error) {
      set({ loading: false });
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (
      response.status === 'INCORRECT_USER_INPUT_CODE_ERROR' ||
      response.status === 'EXPIRED_USER_INPUT_CODE_ERROR'
    ) {
      set({ loading: false });
      throw makeAuthError('Invalid or expired code. Please try again.', response.status);
    }
    if (response.status !== 'OK') {
      set({ loading: false });
      throw makeAuthError('Please request a new code and try again.', response.status);
    }
    await syncAuthenticatedState(set, get, 'signin-authenticated');
    return { status: 'OK' as const };
  },

  checkSession: async () => {
    if (checkSessionPromise) {
      return checkSessionPromise;
    }
    set({ loading: true, error: null, status: 'checking' });
    checkSessionPromise = (async () => {
      try {
        const exists = await Session.doesSessionExist();
        if (!exists) {
          resetAuthState(set);
          return null;
        }
        return await syncAuthenticatedState(set, get, 'authenticated');
      } catch (error) {
        set({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : null,
          status: 'unauthenticated',
          attributes: null,
          role: null,
        });
        return null;
      }
    })().finally(() => {
      checkSessionPromise = null;
    });
    return checkSessionPromise;
  },

  refreshSession: async () => {
    if (refreshSessionPromise) {
      return refreshSessionPromise;
    }
    refreshSessionPromise = (async () => {
      try {
        const refreshed = await Session.attemptRefreshingSession();
        if (!refreshed) {
          resetAuthState(set);
          return null;
        }
        return await syncAuthenticatedState(set, get, 'authenticated');
      } catch (error) {
        logger.warn('refreshSession failed or session invalid:', error);
        resetAuthState(set);
        return null;
      }
    })().finally(() => {
      refreshSessionPromise = null;
    });
    return refreshSessionPromise;
  },

  getValidSession: async (opts) => {
    if (!opts?.forceRefresh) {
      const currentUser = get().user;
      if (currentUser && (await Session.doesSessionExist())) {
        return currentUser;
      }
    }
    const refreshedUser = await get().refreshSession();
    if (refreshedUser) {
      return refreshedUser;
    }
    if (opts?.forceRefresh) {
      return null;
    }
    return get().checkSession();
  },

  signout: async () => {
    removeStorageItem('session', 'devAuth');
    try {
      await postData('/v1/auth/logout', undefined, { skipAuthRedirect: true });
    } catch (error) {
      logger.warn('Failed to revoke the server session on signout', error);
    }
    try {
      await Session.signOut();
    } catch (error) {
      logger.warn('Failed to clear the local session on signout', error);
    }
    resetAuthState(set);
  },

  forgotPassword: async (email: string) => {
    const response = await EmailPassword.sendPasswordResetEmail({
      formFields: [{ id: 'email', value: email }],
    });
    if (response.status === 'FIELD_ERROR') {
      throw makeAuthError(
        response.formFields[0]?.error ?? 'Unable to send the reset email',
        'FIELD_ERROR'
      );
    }
    if (response.status === 'PASSWORD_RESET_NOT_ALLOWED') {
      throw makeAuthError(response.reason, 'PASSWORD_RESET_NOT_ALLOWED');
    }
    logger.info('forgotPassword success');
    return { status: 'OK' as const };
  },

  resetPassword: async (newPassword: string) => {
    const response = await EmailPassword.submitNewPassword({
      formFields: [{ id: 'password', value: newPassword }],
    });
    if (response.status === 'RESET_PASSWORD_INVALID_TOKEN_ERROR') {
      throw makeAuthError(
        'This password reset link is invalid or has expired.',
        'RESET_PASSWORD_INVALID_TOKEN_ERROR'
      );
    }
    if (response.status === 'FIELD_ERROR') {
      throw makeAuthError(
        response.formFields[0]?.error ?? 'Unable to reset the password',
        'FIELD_ERROR'
      );
    }
    return 'success';
  },

  loadUserAttributes: async () => {
    if (!(await Session.doesSessionExist())) {
      return null;
    }
    const me = await fetchMe();
    return applyUserAttributes(set, me);
  },
}));

const resetAuthState = (set: (partial: Partial<AuthStore>) => void) => {
  set({
    status: 'unauthenticated',
    user: null,
    role: null,
    error: null,
    attributes: null,
    loading: false,
    mfaChallenge: null,
  });
  try {
    clearSessionScopedStores();
  } catch (err) {
    logger.warn('Failed to clear session-scoped stores on signout', err);
  }
};
