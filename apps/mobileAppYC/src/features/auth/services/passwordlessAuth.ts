import SuperTokens from 'supertokens-react-native';
import type {ProfileStatus} from '@/features/account/services/profileService';
import {syncAuthUser} from '@/features/auth/services/authUserService';
import {
  initSuperTokens,
  resolveAuthEndpoint,
} from '@/features/auth/services/superTokensClient';
import {
  API_CONFIG,
  AUTH_FEATURE_FLAGS,
  DEMO_LOGIN_CONFIG,
  DEVELOPMENT_API_BASE_URL,
} from '@/config/variables';

export const DEMO_LOGIN_EMAIL = (DEMO_LOGIN_CONFIG.email ?? '')
  .trim()
  .toLowerCase();
export const DEMO_LOGIN_PASSWORD = DEMO_LOGIN_CONFIG.password ?? '';
// SuperTokens USER_INPUT_CODE emails deliver a 6-digit code.
const DEFAULT_OTP_LENGTH = 6;

export type PasswordlessSignInRequestResult = {
  destination: string;
  isNewUser: boolean;
  challengeType: 'otp' | 'demoPassword';
  challengeLength: number;
  isDemoLogin: boolean;
};

export type PasswordlessSignInCompletion = {
  userId: string;
  email: string;
  isNewUser: boolean;
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    userId?: string;
    provider: 'supertokens';
  };
  profile: ProfileStatus;
  parentLinked: boolean;
};

type PasswordlessDeviceState = {
  deviceId: string;
  preAuthSessionId: string;
  email: string;
  apiBase: string;
};

let activeDeviceState: PasswordlessDeviceState | null = null;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isDemoLoginEmail = (username: string): boolean =>
  AUTH_FEATURE_FLAGS.enableReviewLogin === true &&
  DEMO_LOGIN_EMAIL.length > 0 &&
  username === DEMO_LOGIN_EMAIL;

const resolveAuthApiBase = (isDemoLogin: boolean): string =>
  isDemoLogin ? DEVELOPMENT_API_BASE_URL : API_CONFIG.baseUrl;

const parseJsonBody = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  try {
    const body = (await response.json()) as unknown;
    return typeof body === 'object' && body
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const parsePasswordlessError = (error: unknown): string => {
  const data =
    typeof error === 'object' && error
      ? (error as Record<string, unknown>)
      : {};
  const status = typeof data.status === 'string' ? data.status : undefined;
  const message = typeof data.message === 'string' ? data.message : undefined;

  switch (status) {
    case 'INCORRECT_USER_INPUT_CODE_ERROR':
      return 'The code you entered is incorrect. Please try again.';
    case 'EXPIRED_USER_INPUT_CODE_ERROR':
      return 'The code has expired. Request a new one to continue.';
    case 'RESTART_FLOW_ERROR':
      return 'Too many failed attempts. Please request a new code.';
    case 'SIGN_IN_UP_NOT_ALLOWED':
      return typeof data.reason === 'string'
        ? data.reason
        : 'Sign in is not allowed for this account. Please contact support.';
    default:
      break;
  }

  if (message) {
    const normalized = message.toLowerCase();
    if (normalized.includes('expired')) {
      return 'The code has expired. Request a new one to continue.';
    }
    return message;
  }

  return 'Unexpected authentication error. Please retry.';
};

// Step 1: create an OTP device and send the login code email.
export const requestPasswordlessEmailCode = async (
  email: string,
): Promise<PasswordlessSignInRequestResult> => {
  const username = normalizeEmail(email);
  const isDemoLogin = isDemoLoginEmail(username);
  const apiBase = resolveAuthApiBase(isDemoLogin);
  initSuperTokens(apiBase);

  console.log('[Auth] requestPasswordlessEmailCode', {
    username,
    isDemoLogin,
  });

  const response = await fetch(resolveAuthEndpoint('/signinup/code', apiBase), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      rid: 'passwordless',
    },
    body: JSON.stringify({email: username}),
  });

  const data = await parseJsonBody(response);

  if (!response.ok || data.status !== 'OK') {
    console.error('[Auth] Failed to create passwordless code', {
      status: response.status,
      body: data,
    });
    throw new Error(parsePasswordlessError(data));
  }

  activeDeviceState = {
    deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
    preAuthSessionId:
      typeof data.preAuthSessionId === 'string' ? data.preAuthSessionId : '',
    email: username,
    apiBase,
  };

  return {
    destination: username,
    // Unknown until the code is consumed — SuperTokens reports it then.
    isNewUser: false,
    challengeType: isDemoLogin ? 'demoPassword' : 'otp',
    challengeLength: isDemoLogin
      ? DEMO_LOGIN_PASSWORD.length
      : DEFAULT_OTP_LENGTH,
    isDemoLogin,
  };
};

// Step 2: consume the OTP and establish a SuperTokens session.
export const completePasswordlessSignIn = async (
  otpCode: string,
): Promise<PasswordlessSignInCompletion> => {
  const deviceState = activeDeviceState;
  if (!deviceState) {
    throw new Error('Too many failed attempts. Please request a new code.');
  }

  initSuperTokens(deviceState.apiBase);

  const response = await fetch(
    resolveAuthEndpoint('/signinup/code/consume', deviceState.apiBase),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        rid: 'passwordless',
      },
      body: JSON.stringify({
        preAuthSessionId: deviceState.preAuthSessionId,
        deviceId: deviceState.deviceId,
        userInputCode: otpCode,
      }),
    },
  );

  const data = await parseJsonBody(response);

  if (!response.ok || data.status !== 'OK') {
    if (data.status === 'RESTART_FLOW_ERROR') {
      activeDeviceState = null;
    }
    throw new Error(parsePasswordlessError(data));
  }

  activeDeviceState = null;

  // The SuperTokens SDK captured the session tokens from the response
  // headers; token freshness always comes from the SDK from here on.
  const accessToken = await SuperTokens.getAccessToken();
  if (!accessToken) {
    throw new Error('Authentication tokens are missing from the session.');
  }

  const user =
    typeof data.user === 'object' && data.user
      ? (data.user as {id?: string; emails?: string[]})
      : {};
  const userId = user.id ?? (await SuperTokens.getUserId());
  const userEmail = user.emails?.[0] ?? deviceState.email;
  const isNewUser = Boolean(data.createdNewUser ?? data.createdNewRecipeUser);

  let authSync: Awaited<ReturnType<typeof syncAuthUser>> | undefined;
  try {
    authSync = await syncAuthUser({authToken: accessToken});
  } catch (error) {
    console.warn('[Auth] Failed to sync auth user during OTP flow', error);
  }

  const normalizedProfile: ProfileStatus = authSync?.parentSummary
    ? {
        exists: true,
        isComplete: Boolean(authSync.parentSummary.isComplete),
        profileToken: authSync.parentSummary.profileImageUrl,
        source: 'remote',
        parent: authSync.parentSummary,
      }
    : {
        exists: false,
        isComplete: false,
        profileToken: undefined,
        source: 'remote',
      };

  console.log('[Auth] SuperTokens email OTP login complete', {
    userId,
    email: userEmail,
    isNewUser,
    provider: 'supertokens',
  });

  return {
    userId,
    email: userEmail,
    isNewUser,
    tokens: {
      idToken: accessToken,
      accessToken,
      refreshToken: undefined,
      expiresAt: undefined,
      userId,
      provider: 'supertokens',
    },
    profile: normalizedProfile,
    parentLinked: authSync?.parentLinked ?? false,
  };
};

export const signOutEverywhere = async () => {
  try {
    await SuperTokens.signOut();
    console.log('[SuperTokens] Signed out');
  } catch (error) {
    console.warn('[SuperTokens] Sign out failed:', error);
  }
};

export const formatAuthError = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return parsePasswordlessError(error);
};

export const __resetPasswordlessStateForTesting = () => {
  activeDeviceState = null;
};
