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
import { AuthError } from 'aws-amplify/auth';
import { PASSWORDLESS_AUTH_CONFIG } from '@/config/auth';

export type PasswordlessSignInRequestResult = {
  destination: string;
  isNewUser: boolean;
  nextStep: SignInOutput['nextStep'];
};

export type PasswordlessSignInCompletion = {
  user: AuthUser;
  attributes: Awaited<ReturnType<typeof fetchUserAttributes>>;
  tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  profile: {
    exists: boolean;
    profileToken: string;
  };
};

const PROFILE_SERVICE_URL = PASSWORDLESS_AUTH_CONFIG.profileServiceUrl;

const randomPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+';
  const all = `${upper}${lower}${digits}${symbols}`;

  const pick = (source: string) => source.charAt(Math.floor(Math.random() * source.length));

  const requiredChars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remainingLength = 14 - requiredChars.length;
  for (let i = 0; i < remainingLength; i += 1) {
    requiredChars.push(pick(all));
  }

  for (let i = requiredChars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
  }

  return requiredChars.join('');
};


const normalizeEmail = (email: string) => email.trim().toLowerCase();

const ensureUserRegistration = async (username: string): Promise<boolean> => {
  try {
    console.log('[Auth] ensureUserRegistration signUp attempt', { username });
    await signUp({
      username,
      password: randomPassword(),
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
    typeof error === 'object' && error && 'name' in error
      ? String((error as { name?: unknown }).name)
      : undefined;
  const amplifyMessage =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
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

export const requestPasswordlessEmailCode = async (
  email: string,
): Promise<PasswordlessSignInRequestResult> => {
  const username = normalizeEmail(email);
  console.log('[Auth] requestPasswordlessEmailCode normalized email', { email, username });
  let isNewUser = false;

  try {
    isNewUser = await ensureUserRegistration(username);
  } catch (signupError) {
    throw new Error(parsePasswordlessError(signupError));
  }

  try {
    const signInInput = {
      username,
      options: {
        authFlowType: 'CUSTOM_WITHOUT_SRP' as const,
        clientMetadata: {
          loginEmail: username,
        },
      },
    };
    console.log('[Auth] signIn input', signInInput);
    const signInOutput = await signIn(signInInput);

    return {
      destination: username,
      isNewUser,
      nextStep: signInOutput.nextStep,
    };
  } catch (error) {
    console.error('[Auth] signIn after ensureUserRegistration failed', { username, error });
    throw new Error(parsePasswordlessError(error));
  }
};

const checkProfileStatus = async (
  accessToken: string,
  userId: string,
  email: string,
): Promise<{ exists: boolean; profileToken: string }> => {
  if (!PROFILE_SERVICE_URL) {
    const mockProfileToken = `mock-profile-token-${userId}`;
    return { exists: false, profileToken: mockProfileToken };
  }

  try {
    const response = await fetch(`${PROFILE_SERVICE_URL}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId, email }),
    });

    if (!response.ok) {
      return {
        exists: false,
        profileToken: `fallback-profile-token-${userId}`,
      };
    }

    const payload = await response.json();
    return {
      exists: Boolean(payload?.exists),
      profileToken: payload?.profileToken ?? `profile-token-${userId}`,
    };
  } catch (error) {
    console.warn('Profile status lookup failed; continuing with mock token.', error);
    return {
      exists: false,
      profileToken: `mock-profile-token-${userId}`,
    };
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

  const profile = await checkProfileStatus(accessToken, authUser.userId, attributes.email ?? authUser.username);

  return {
    user: authUser,
    attributes,
    tokens: {
      idToken,
      accessToken,
      refreshToken: undefined,
      expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
    },
    profile,
  };
};

export const signOutEverywhere = async () => {
  await signOut({ global: true });
};

export const formatAuthError = (error: unknown) => parsePasswordlessError(error);
