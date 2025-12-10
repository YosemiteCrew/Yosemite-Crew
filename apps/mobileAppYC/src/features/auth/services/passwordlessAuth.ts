import 'react-native-get-random-values';
import {
  confirmSignIn,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  type SignInOutput,
  type AuthUser,
} from 'aws-amplify/auth';
import {AuthError} from 'aws-amplify/auth';
import type {ProfileStatus} from '@/features/account/services/profileService';
import {syncAuthUser} from '@/features/auth/services/authUserService';
import {AUTH_FEATURE_FLAGS, DEMO_LOGIN_CONFIG} from '@/config/variables';

export const DEMO_LOGIN_EMAIL = (DEMO_LOGIN_CONFIG.email ?? '').trim().toLowerCase();
export const DEMO_LOGIN_PASSWORD = DEMO_LOGIN_CONFIG.password ?? '';
const DEFAULT_OTP_LENGTH = 4;

export type PasswordlessSignInRequestResult = {
  destination: string;
  isNewUser: boolean;
  nextStep: SignInOutput['nextStep'];
  challengeType: 'otp' | 'demoPassword';
  challengeLength: number;
  isDemoLogin: boolean;
};

export type PasswordlessSignInCompletion = {
  user: AuthUser;
  attributes: Awaited<ReturnType<typeof fetchUserAttributes>>;
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    userId?: string;
    provider: 'amplify';
  };
  profile: ProfileStatus;
  parentLinked: boolean;
};

const secureRandomInt = (max: number): number => {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error('Secure random number generator is unavailable');
  }
  const buffer = new Uint32Array(1);
  cryptoObj.getRandomValues(buffer);
  return buffer[0] % max;
};

const randomPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+';
  const all = `${upper}${lower}${digits}${symbols}`;

  const pick = (source: string) => source.charAt(secureRandomInt(source.length));

  const requiredChars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remainingLength = 14 - requiredChars.length;
  for (let i = 0; i < remainingLength; i += 1) {
    requiredChars.push(pick(all));
  }

  for (let i = requiredChars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
  }

  return requiredChars.join('');
};


const normalizeEmail = (email: string) => email.trim().toLowerCase();

const ensureUserRegistration = async (username: string): Promise<boolean> => {
  try {
    console.log('[Auth] ensureUserRegistration signUp attempt', { username });
    const allowReviewLogin = AUTH_FEATURE_FLAGS.enableReviewLogin === true;
    const isDemoLogin = allowReviewLogin && DEMO_LOGIN_EMAIL.length > 0 && username === DEMO_LOGIN_EMAIL;
    await signUp({
      username,
      password: isDemoLogin && DEMO_LOGIN_PASSWORD ? DEMO_LOGIN_PASSWORD : randomPassword(),
      options: {
        userAttributes: {
          email: username,
          preferred_username: username,
        },
      },
    });
    console.log('[Auth] ensureUserRegistration signUp completed', { username });
    return true;
  } catch (signupError) {
    if (signupError instanceof AuthError && signupError.name === 'UsernameExistsException') {
      console.log('[Auth] ensureUserRegistration user already exists', { username });
      return false;
    }

    console.error('[Auth] ensureUserRegistration signUp failed', { username, signupError });
    throw signupError;
  }
};

const parsePasswordlessError = (error: unknown) => {
  const amplifyName =
    typeof error === 'object' && error && 'name' in error && typeof error.name === 'string'
      ? error.name
      : undefined;
  const amplifyMessage =
    typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : undefined;

  switch (amplifyName) {
    case 'InvalidParameterException':
      return 'The email address looks invalid. Please try again.';
    case 'CodeMismatchException':
    case 'NotAuthorizedException':
    case 'ChallengeResponseNotCorrectException':
      return 'The code you entered is incorrect. Please try again.';
    case 'ExpiredCodeException':
      return 'The code has expired. Request a new one to continue.';
    default:
      break;
  }

  if (amplifyMessage) {
    const normalized = amplifyMessage.toLowerCase();
    if (normalized.includes('code mismatch') || normalized.includes('incorrect code')) {
      return 'The code you entered is incorrect. Please try again.';
    }
    if (normalized.includes('expired')) {
      return 'The code has expired. Request a new one to continue.';
    }
  }

  if (error instanceof AuthError) {
    return error.message ?? 'Something went wrong with authentication.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected authentication error. Please retry.';
};

const isNoActiveSessionError = (error: unknown): boolean => {
  if (error instanceof AuthError) {
    return (
      error.name === 'AuthSessionNotSetError' ||
      error.name === 'UserNotAuthenticatedException' ||
      error.name === 'UserUnAuthenticatedException' ||
      error.name === 'NotAuthorizedException'
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('there is no current user') ||
      message.includes('no current user') ||
      message.includes('user is not authenticated') ||
      message.includes('user needs to be authenticated to call this api')
    );
  }

  return false;
};

export const requestPasswordlessEmailCode = async (
  email: string,
): Promise<PasswordlessSignInRequestResult> => {
  const username = normalizeEmail(email);
  console.log('[Auth] requestPasswordlessEmailCode normalized email', { email, username });
  let isNewUser = false;
  const allowReviewLogin = AUTH_FEATURE_FLAGS.enableReviewLogin === true;
  const isDemoLogin =
    allowReviewLogin && DEMO_LOGIN_EMAIL.length > 0 && username === DEMO_LOGIN_EMAIL;

  // First, ensure we sign out any existing session
  try {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      console.log('[Auth] Found existing session, signing out before new sign in');
      await signOutEverywhere();
    }
  } catch (error) {
    if (isNoActiveSessionError(error)) {
      // No existing session, continue with sign in
      console.log('[Auth] No existing session found, proceeding with sign in');
    } else {
      console.error('[Auth] Unexpected error while checking current user', error);
      throw error;
    }
  }

  try {
    isNewUser = await ensureUserRegistration(username);
  } catch (signupError) {
    throw new Error(parsePasswordlessError(signupError));
  }

  try {
    const clientMetadata: Record<string, string> = {
      loginEmail: username,
    };
    if (isDemoLogin) {
      clientMetadata.demoLogin = 'true';
    }

    const signInInput = {
      username,
      options: {
        authFlowType: 'CUSTOM_WITHOUT_SRP' as const,
        clientMetadata,
      },
    };
    console.log('[Auth] signIn input', signInInput);
    const signInOutput = await signIn(signInInput);

    return {
      destination: username,
      isNewUser,
      nextStep: signInOutput.nextStep,
      challengeType: isDemoLogin ? 'demoPassword' : 'otp',
      challengeLength: isDemoLogin ? DEMO_LOGIN_PASSWORD.length : DEFAULT_OTP_LENGTH,
      isDemoLogin,
    };
  } catch (error) {
    console.error('[Auth] signIn after ensureUserRegistration failed', { username, error });
    throw new Error(parsePasswordlessError(error));
  }
};

export const completePasswordlessSignIn = async (
  otpCode: string,
): Promise<PasswordlessSignInCompletion> => {
  const confirmation = await confirmSignIn({
    challengeResponse: otpCode,
  });

  if (!confirmation.isSignedIn) {
    throw new Error(parsePasswordlessError('Additional verification required.'));
  }

  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();
  const expiresAtSeconds =
    session.tokens?.idToken?.payload?.exp ??
    session.tokens?.accessToken?.payload?.exp ??
    undefined;

  if (!idToken || !accessToken) {
    throw new Error('Authentication tokens are missing from the session.');
  }

  const [authUser, attributes] = await Promise.all([
    getCurrentUser(),
    fetchUserAttributes(),
  ]);

  let authSync: Awaited<ReturnType<typeof syncAuthUser>> | undefined;
  try {
    authSync = await syncAuthUser({
      authToken: idToken ?? accessToken,
      idToken,
    });
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

  // Console logs for Cognito/Amplify authentication
  console.log('╔════════════════════════════════════════╗');
  console.log('║   COGNITO/AMPLIFY - EMAIL OTP LOGIN   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('JWT (ID Token):', idToken);
  console.log('Access Token:', accessToken);
  console.log('User ID:', authUser.userId);
  console.log('Email:', attributes.email);
  console.log('Provider: amplify');
  console.log('═══════════════════════════════════════');

  return {
    user: authUser,
    attributes,
    tokens: {
      idToken,
      accessToken,
      refreshToken: undefined,
      expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
      userId: authUser.userId,
      provider: 'amplify',
    },
    profile: normalizedProfile,
    parentLinked: authSync?.parentLinked ?? false,
  };
};

export const signOutEverywhere = async () => {
  try {
    // Try global sign out first
    await signOut({ global: true });
    console.log('[Amplify] Signed out globally');
  } catch (globalError) {
    console.warn('[Amplify] Global sign out failed:', globalError);
    
    // If global sign out fails, try local sign out
    try {
      await signOut({ global: false });
      console.log('[Amplify] Signed out locally');
    } catch (localError) {
      console.warn('[Amplify] Local sign out also failed:', localError);
      
      // Check if it's an OAuth error (user might have signed in with social provider)
      const errorName = (localError as any)?.name;
      if (errorName === 'OAuthSignOutException') {
        console.log('[Amplify] OAuth sign out error - user may have signed in with social provider');
        // Don't throw the error, just log it
        // The user session will be cleared locally anyway
      } else {
        // For other errors, we might want to throw
        throw localError;
      }
    }
  }
};


export const formatAuthError = (error: unknown) => parsePasswordlessError(error);
