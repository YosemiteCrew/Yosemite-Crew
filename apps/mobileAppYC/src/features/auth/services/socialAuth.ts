import 'react-native-get-random-values';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuid} from 'uuid';
import SuperTokens from 'supertokens-react-native';
import * as Keychain from 'react-native-keychain';
import {
  GoogleSignin,
  statusCodes as GoogleStatusCodes,
} from '@react-native-google-signin/google-signin';
import {
  appleAuth,
  appleAuthAndroid,
} from '@invertase/react-native-apple-authentication';
import {
  LoginManager,
  AccessToken,
  Settings,
  AuthenticationToken,
} from 'react-native-fbsdk-next';
import {sha256} from 'js-sha256';
import {API_CONFIG, PASSWORDLESS_AUTH_CONFIG} from '@/config/variables';
import type {ProfileStatus} from '@/features/account/services/profileService';
import type {User, AuthTokens} from '@/features/auth/context/AuthContext';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';
import {syncAuthUser} from '@/features/auth/services/authUserService';
import {
  initSuperTokens,
  resolveAuthEndpoint,
} from '@/features/auth/services/superTokensClient';

export type SocialProvider = 'google' | 'facebook' | 'apple';

export interface SocialAuthResult {
  user: User;
  tokens: AuthTokens;
  profile: ProfileStatus;
  parentLinked: boolean;
  initialAttributes: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phone?: string;
    profilePicture?: string;
  };
}

let providersConfigured = false;
const APPLE_PROFILE_CACHE_PREFIX = '@apple_profile_cache:';
const APPLE_PROFILE_KEYCHAIN_SERVICE = 'yosemite-apple-profile';
const APPLE_PROFILE_KEYCHAIN_ACCOUNT = 'apple-profile';

const clearLegacyAppleProfileCache = async (userId: string) => {
  try {
    await AsyncStorage.removeItem(`${APPLE_PROFILE_CACHE_PREFIX}${userId}`);
  } catch (error) {
    console.warn(
      '[SocialAuth][Apple] Failed to clear legacy cached profile from storage',
      error,
    );
  }
};

const parseName = (
  fullName?: string | null,
): {firstName?: string; lastName?: string} => {
  if (!fullName) {
    return {};
  }

  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.length ? rest.join(' ') : undefined;
  return {firstName, lastName};
};

const getCachedAppleProfile = async (
  userId: string,
): Promise<{
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null> => {
  const keychainService = `${APPLE_PROFILE_KEYCHAIN_SERVICE}-${userId}`;
  try {
    const keychainResult = await Keychain.getGenericPassword({
      service: keychainService,
    });
    if (
      keychainResult &&
      typeof keychainResult !== 'boolean' &&
      keychainResult.password
    ) {
      return JSON.parse(keychainResult.password);
    }
  } catch (error) {
    console.warn(
      '[SocialAuth][Apple] Failed to read cached profile from Keychain',
      error,
    );
  }
  await clearLegacyAppleProfileCache(userId);
  return null;
};

const cacheAppleProfile = async (
  userId: string,
  profile: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  },
) => {
  const normalized = {
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    email: profile.email ?? null,
  };

  const keychainService = `${APPLE_PROFILE_KEYCHAIN_SERVICE}-${userId}`;
  try {
    await Keychain.setGenericPassword(
      APPLE_PROFILE_KEYCHAIN_ACCOUNT,
      JSON.stringify(normalized),
      {
        service: keychainService,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
      },
    );
  } catch (error) {
    console.warn(
      '[SocialAuth][Apple] Failed to cache profile in Keychain',
      error,
    );
  }
  await clearLegacyAppleProfileCache(userId);
};

type NativeCredential = {
  accessToken?: string;
  idToken?: string;
  authorizationCode?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
};

const extractGoogleProfile = (
  signInResult: unknown,
): Pick<NativeCredential, 'email' | 'firstName' | 'lastName' | 'avatarUrl'> => {
  const result = (signInResult ?? {}) as {
    data?: {user?: Record<string, unknown>};
    user?: Record<string, unknown>;
  };
  const user = result.data?.user ?? result.user ?? {};
  const name = typeof user.name === 'string' ? user.name : undefined;
  const parsed = parseName(name);

  return {
    email: typeof user.email === 'string' ? user.email : null,
    firstName:
      typeof user.givenName === 'string'
        ? user.givenName
        : (parsed.firstName ?? null),
    lastName:
      typeof user.familyName === 'string'
        ? user.familyName
        : (parsed.lastName ?? null),
    avatarUrl: typeof user.photo === 'string' ? user.photo : null,
  };
};

const performGoogleSignIn = async (): Promise<NativeCredential> => {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

  try {
    await GoogleSignin.signOut();
  } catch (signOutError) {
    console.warn(
      '[GoogleAuth] Unable to clear previous Google session',
      signOutError,
    );
  }

  let signInResult: unknown;
  try {
    signInResult = await GoogleSignin.signIn();
  } catch (err: any) {
    if (err?.code === GoogleStatusCodes.SIGN_IN_CANCELLED) {
      const e = new Error('Google sign-in cancelled');
      (e as any).code = 'auth/cancelled';
      throw e;
    }
    throw err;
  }

  let idToken: string | undefined;
  let accessToken: string | undefined;
  try {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens?.idToken ?? undefined;
    accessToken = tokens?.accessToken ?? undefined;
  } catch (err: any) {
    await GoogleSignin.signOut().catch(() => undefined);
    const e = new Error(
      err?.code === GoogleStatusCodes.SIGN_IN_CANCELLED
        ? 'Google sign-in cancelled'
        : 'We couldn’t sign you in with Google. Kindly retry.',
    );
    (e as any).code = err?.code ?? 'auth/cancelled';
    throw e;
  }

  if (!idToken) {
    throw new Error('Google sign-in failed. Missing ID token.');
  }

  return {
    idToken,
    accessToken,
    ...extractGoogleProfile(signInResult),
  };
};

const performFacebookSignIn = async (): Promise<NativeCredential> => {
  LoginManager.logOut();

  if (Platform.OS === 'ios') {
    const rawNonce = uuid();
    const hashedNonce = sha256(rawNonce);

    const loginResult = await LoginManager.logInWithPermissions(
      ['public_profile', 'email'],
      'limited',
      hashedNonce,
    );

    if (loginResult.isCancelled) {
      const e = new Error('Facebook sign-in cancelled');
      (e as any).code = 'auth/cancelled';
      throw e;
    }

    const tokenResult = await AuthenticationToken.getAuthenticationTokenIOS();
    const authenticationToken = tokenResult?.authenticationToken;

    if (!authenticationToken) {
      throw new Error(
        'Facebook sign-in failed. Missing authentication token from Facebook.',
      );
    }

    // Limited login returns an OIDC token — exchanged as an id_token.
    return {idToken: authenticationToken};
  }

  const loginResult = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ]);

  if (loginResult.isCancelled) {
    const e = new Error('Facebook sign-in cancelled');
    (e as any).code = 'auth/cancelled';
    throw e;
  }

  const currentAccessToken = await AccessToken.getCurrentAccessToken();
  if (!currentAccessToken?.accessToken) {
    throw new Error('Facebook sign-in failed. Missing access token.');
  }

  return {accessToken: currentAccessToken.accessToken};
};

const signInWithAppleIOS = async (): Promise<NativeCredential> => {
  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  if (!appleAuthRequestResponse.identityToken) {
    throw new Error('Apple Sign-In failed - no identity token returned');
  }

  return {
    idToken: appleAuthRequestResponse.identityToken,
    authorizationCode: appleAuthRequestResponse.authorizationCode ?? undefined,
    firstName: appleAuthRequestResponse.fullName?.givenName ?? null,
    lastName: appleAuthRequestResponse.fullName?.familyName ?? null,
    email: appleAuthRequestResponse.email ?? null,
  };
};

const signInWithAppleAndroid = async (): Promise<NativeCredential> => {
  if (!appleAuthAndroid.isSupported) {
    throw new Error('Apple sign-in requires Android API 19+.');
  }

  const {appleServiceId, appleRedirectUri} = PASSWORDLESS_AUTH_CONFIG ?? {};

  if (!appleServiceId || !appleRedirectUri) {
    throw new Error(
      '[AppleAuth] Missing appleServiceId or appleRedirectUri in PASSWORDLESS_AUTH_CONFIG.',
    );
  }

  const rawNonce = uuid();
  const state = uuid();

  appleAuthAndroid.configure({
    clientId: appleServiceId,
    redirectUri: appleRedirectUri,
    responseType: appleAuthAndroid.ResponseType.ALL,
    scope: appleAuthAndroid.Scope.ALL,
    nonce: rawNonce,
    state,
  });

  const response = await appleAuthAndroid.signIn();

  const idToken = response?.id_token;
  if (!idToken) {
    throw new Error('Apple Sign-In failed - no id_token returned.');
  }

  const firstName = (response as any)?.user?.name?.firstName ?? null;
  const lastName = (response as any)?.user?.name?.lastName ?? null;
  const email = (response as any)?.user?.email ?? null;

  return {idToken, firstName, lastName, email};
};

const mapAppleSignInError = (error: any): Error => {
  console.error('[AppleAuth] Error in performAppleSignIn:', {
    error,
    code: error?.code,
    message: error?.message,
  });

  if (error?.code === 'auth/account-exists-with-different-credential') {
    return new Error(
      'An account already exists with the same email but different sign-in credentials.',
    );
  }

  if (error?.message?.includes('invalid_client')) {
    return new Error(
      'Apple configuration error (invalid_client). Verify Service ID, Key linkage to the Primary App ID, and exact redirect URL.',
    );
  }

  if (error?.code === appleAuth.Error.CANCELED) {
    const cancelled = new Error('Apple sign-in cancelled');
    (cancelled as any).code = 'auth/cancelled';
    return cancelled;
  }

  if (error?.code === appleAuth.Error.FAILED) {
    return new Error('Apple sign-in failed. Please try again.');
  }

  if (error?.code === appleAuth.Error.INVALID_RESPONSE) {
    return new Error('Invalid response from Apple. Please try again.');
  }

  if (error?.code === appleAuth.Error.NOT_HANDLED) {
    return new Error('Apple sign-in is not supported on this device.');
  }

  return error instanceof Error ? error : new Error(String(error));
};

const performAppleSignIn = async (): Promise<NativeCredential> => {
  try {
    if (Platform.OS === 'ios') {
      return await signInWithAppleIOS();
    }

    if (Platform.OS === 'android') {
      return await signInWithAppleAndroid();
    }

    throw new Error('Apple sign-in is not supported on this platform.');
  } catch (error: any) {
    throw mapAppleSignInError(error);
  }
};

const resolveNativeCredential = async (
  provider: SocialProvider,
): Promise<NativeCredential> => {
  switch (provider) {
    case 'google':
      return performGoogleSignIn();
    case 'facebook':
      return performFacebookSignIn();
    case 'apple':
      return performAppleSignIn();
    default:
      throw new Error(`Unsupported social provider: ${provider}`);
  }
};

export const configureSocialProviders = () => {
  if (providersConfigured) {
    return;
  }

  providersConfigured = true;

  if (PASSWORDLESS_AUTH_CONFIG.googleWebClientId) {
    GoogleSignin.configure({
      webClientId: PASSWORDLESS_AUTH_CONFIG.googleWebClientId,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  } else {
    console.warn(
      '[SocialAuth] googleWebClientId is not configured. Google sign-in will fail until it is provided.',
    );
  }

  if (PASSWORDLESS_AUTH_CONFIG.facebookAppId) {
    Settings.setAppID(PASSWORDLESS_AUTH_CONFIG.facebookAppId);
    Settings.initializeSDK();
  } else {
    console.warn(
      '[SocialAuth] facebookAppId is not configured. Facebook sign-in will fail until it is provided.',
    );
  }
};

type SignInUpExchange = {
  userId: string;
  email?: string;
  isNewUser: boolean;
};

const buildSignInUpBody = (
  provider: SocialProvider,
  credential: NativeCredential,
): Record<string, unknown> => {
  if (
    provider === 'apple' &&
    Platform.OS === 'ios' &&
    credential.authorizationCode
  ) {
    // Apple requires the authorization-code flow on the backend.
    return {
      thirdPartyId: 'apple',
      redirectURIInfo: {
        redirectURIOnProviderDashboard: '',
        redirectURIQueryParams: {
          code: credential.authorizationCode,
          id_token: credential.idToken,
        },
      },
    };
  }

  const oAuthTokens: Record<string, string> = {};
  if (credential.accessToken) {
    oAuthTokens.access_token = credential.accessToken;
  }
  if (credential.idToken) {
    oAuthTokens.id_token = credential.idToken;
  }

  return {
    thirdPartyId: provider,
    oAuthTokens,
  };
};

const ACCOUNT_EXISTS_CODE = 'auth/account-exists-with-different-credential';

const mapSignInUpError = (data: Record<string, unknown>): Error => {
  if (data.status === 'SIGN_IN_UP_NOT_ALLOWED') {
    const message =
      typeof data.reason === 'string'
        ? data.reason
        : 'An account already exists with this email. Sign in using your existing login method and try again.';
    const conflictError = new Error(message);
    (conflictError as any).code = ACCOUNT_EXISTS_CODE;
    return conflictError;
  }

  const message =
    typeof data.message === 'string'
      ? data.message
      : 'Social sign-in failed. Please try again.';
  return new Error(message);
};

const exchangeWithSuperTokens = async (
  provider: SocialProvider,
  credential: NativeCredential,
): Promise<SignInUpExchange> => {
  initSuperTokens(API_CONFIG.baseUrl);

  const response = await fetch(resolveAuthEndpoint('/signinup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      rid: 'thirdparty',
    },
    body: JSON.stringify(buildSignInUpBody(provider, credential)),
  });

  let data: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as unknown;
    data = typeof body === 'object' && body ? (body as typeof data) : {};
  } catch {
    data = {};
  }

  if (!response.ok || data.status !== 'OK') {
    console.error('[SocialAuth] SuperTokens signinup failed', {
      provider,
      status: response.status,
      body: data,
    });
    throw mapSignInUpError(data);
  }

  const user =
    typeof data.user === 'object' && data.user
      ? (data.user as {id?: string; emails?: string[]})
      : {};

  if (!user.id) {
    throw new Error('Social sign-in failed. Missing user in response.');
  }

  return {
    userId: user.id,
    email: user.emails?.[0],
    isNewUser: Boolean(data.createdNewUser ?? data.createdNewRecipeUser),
  };
};

type AuthSyncResult = Awaited<ReturnType<typeof syncAuthUser>>;

const mapProfileFromAuthSync = (authSync?: AuthSyncResult): ProfileStatus =>
  authSync?.parentSummary
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

const buildUserFromProfile = (params: {
  userId: string;
  email: string;
  profile: ProfileStatus;
  credential: NativeCredential;
}): User => {
  const {userId, email, profile, credential} = params;
  const baseUser: User = {
    id: userId,
    parentId: profile.parent?.id ?? undefined,
    email,
    firstName: credential.firstName ?? undefined,
    lastName: credential.lastName ?? undefined,
    profilePicture: credential.avatarUrl ?? undefined,
    profileToken: profile.profileToken,
  };
  const userWithProfile = mergeUserWithParentProfile(baseUser, profile.parent);
  return {
    ...userWithProfile,
    profileCompleted: profile.isComplete ?? userWithProfile.profileCompleted,
  };
};

const logSocialLogin = (
  provider: SocialProvider,
  tokens: AuthTokens,
  user: User,
) => {
  console.log(`[SocialAuth] SuperTokens ${provider} login complete`, {
    userId: tokens.userId,
    email: user.email,
    provider: 'supertokens',
  });
};

const determineErrorCode = (error: any): string | undefined => {
  if (typeof error?.code === 'string') {
    return error.code;
  }
  const message =
    typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('cancel') ? 'auth/cancelled' : undefined;
};

const handleSocialSignInError = async (
  provider: SocialProvider,
  error: any,
): Promise<never> => {
  if (provider === 'google') {
    try {
      await GoogleSignin.signOut();
    } catch (googleSignOutError) {
      console.warn(
        '[SocialAuth] Google sign-out after cancellation failed',
        googleSignOutError,
      );
    }
  }

  const normalizedCode = determineErrorCode(error);
  if (normalizedCode === 'auth/cancelled') {
    console.log(
      '[SocialAuth] Sign-in cancelled by user; suppressing error toast.',
    );
    const cancelledError = new Error('auth/cancelled');
    (cancelledError as any).code = 'auth/cancelled';
    throw cancelledError;
  }

  console.error(
    `[SocialAuth] Error in signInWithSocialProvider (${provider}):`,
    {
      error,
      message: error?.message,
      code: error?.code,
    },
  );
  throw error instanceof Error
    ? error
    : new Error(String(error ?? 'Social sign-in failed'));
};

const resolveAppleMetadata = async (
  userId: string,
  credential: NativeCredential,
  exchangeEmail?: string,
): Promise<NativeCredential> => {
  const cached = await getCachedAppleProfile(userId);

  const merged: NativeCredential = {
    ...credential,
    firstName: credential.firstName ?? cached?.firstName ?? null,
    lastName: credential.lastName ?? cached?.lastName ?? null,
    email: credential.email ?? cached?.email ?? exchangeEmail ?? null,
  };

  // Apple only shares the name/email on first authorization — persist it
  // so future logins can prefill the profile.
  await cacheAppleProfile(userId, {
    firstName: merged.firstName,
    lastName: merged.lastName,
    email: merged.email,
  });

  console.log('[SocialAuth][Apple] Resolved profile metadata', {
    cached,
    mergedMetadata: {
      firstName: merged.firstName,
      lastName: merged.lastName,
      email: merged.email,
    },
  });

  return merged;
};

export const signInWithSocialProvider = async (
  provider: SocialProvider,
): Promise<SocialAuthResult> => {
  try {
    console.log(`[SocialAuth] Starting ${provider} sign-in...`);
    let credential = await resolveNativeCredential(provider);

    const exchange = await exchangeWithSuperTokens(provider, credential);

    if (provider === 'apple') {
      credential = await resolveAppleMetadata(
        exchange.userId,
        credential,
        exchange.email,
      );
    }

    const email = exchange.email ?? credential.email ?? undefined;
    if (!email) {
      throw new Error(
        'We could not retrieve your email address from the selected provider. Please allow email access and try again.',
      );
    }

    // The SDK captured the session from the signinup response headers.
    const accessToken = await SuperTokens.getAccessToken();
    if (!accessToken) {
      throw new Error('Authentication tokens are missing from the session.');
    }

    let authSync: AuthSyncResult | undefined;
    try {
      authSync = await syncAuthUser({authToken: accessToken});
    } catch (error) {
      console.warn(
        '[SocialAuth] Failed to sync auth user, proceeding with default profile',
        error,
      );
    }

    const profile = mapProfileFromAuthSync(authSync);
    const user = buildUserFromProfile({
      userId: exchange.userId,
      email,
      profile,
      credential,
    });
    const completeTokens: AuthTokens = {
      idToken: accessToken,
      accessToken,
      userId: exchange.userId,
      provider: 'supertokens',
    };
    const initialFirstName =
      user.firstName ?? credential.firstName ?? undefined;
    const initialLastName = user.lastName ?? credential.lastName ?? undefined;

    logSocialLogin(provider, completeTokens, user);

    return {
      user,
      tokens: completeTokens,
      profile,
      parentLinked: authSync?.parentLinked ?? false,
      initialAttributes: {
        firstName: initialFirstName,
        lastName: initialLastName,
        profilePicture: user.profilePicture,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
      },
    };
  } catch (error: any) {
    return handleSocialSignInError(provider, error);
  }
};
