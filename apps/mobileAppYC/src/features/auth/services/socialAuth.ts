import 'react-native-get-random-values';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuid } from 'uuid'
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
  AppleAuthProvider,
  updateProfile,
  getIdToken,
  getIdTokenResult,
} from '@react-native-firebase/auth';
import * as Keychain from 'react-native-keychain';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {GoogleSignin, statusCodes as GoogleStatusCodes} from '@react-native-google-signin/google-signin';
import {appleAuth,appleAuthAndroid} from '@invertase/react-native-apple-authentication';
import {
  LoginManager,
  AccessToken,
  Settings,
  AuthenticationToken,
} from 'react-native-fbsdk-next';
import {sha256} from 'js-sha256';
import {PASSWORDLESS_AUTH_CONFIG} from '@/config/variables';
import type {ProfileStatus} from '@/features/account/services/profileService';
import type {User, AuthTokens} from '@/features/auth/context/AuthContext';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';
import {syncAuthUser} from '@/features/auth/services/authUserService';

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

const resolveDisplayInfo = (
  user: FirebaseAuthTypes.User,
  provider: SocialProvider,
  extra?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
) => {
  const email = extra?.email ?? user.email ?? undefined;
  const displayNameParts = parseName(user.displayName);

  return {
    email,
    firstName: extra?.firstName ?? displayNameParts.firstName,
    lastName: extra?.lastName ?? displayNameParts.lastName,
    provider,
    avatarUrl: user.photoURL ?? undefined,
  };
};

const buildTokens = async (
  user: FirebaseAuthTypes.User,
): Promise<Pick<AuthTokens, 'idToken' | 'accessToken' | 'expiresAt' | 'userId'>> => {
  // Avoid forcing refresh to reduce deprecation noise; rely on Firebase to refresh as needed
  const idToken = await getIdToken(user);
  const idTokenResult = await getIdTokenResult(user);
  const expiresAtTimestamp = idTokenResult?.expirationTime
    ? new Date(idTokenResult.expirationTime).getTime()
    : undefined;

  return {
    idToken,
    accessToken: idToken,
    expiresAt: expiresAtTimestamp,
    userId: user.uid,
  };
};

const getCachedAppleProfile = async (
  userId: string,
): Promise<{firstName?: string | null; lastName?: string | null; email?: string | null} | null> => {
  const keychainService = `${APPLE_PROFILE_KEYCHAIN_SERVICE}-${userId}`;
  try {
    const keychainResult = await Keychain.getGenericPassword({service: keychainService});
    if (keychainResult && typeof keychainResult !== 'boolean' && keychainResult.password) {
      return JSON.parse(keychainResult.password);
    }
  } catch (error) {
    console.warn('[SocialAuth][Apple] Failed to read cached profile from Keychain', error);
  }

  try {
    const raw = await AsyncStorage.getItem(`${APPLE_PROFILE_CACHE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[SocialAuth][Apple] Failed to read cached profile from storage', error);
    return null;
  }
};

const cacheAppleProfile = async (
  userId: string,
  profile: {firstName?: string | null; lastName?: string | null; email?: string | null},
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
    console.warn('[SocialAuth][Apple] Failed to cache profile in Keychain', error);
  }

  try {
    await AsyncStorage.setItem(
      `${APPLE_PROFILE_CACHE_PREFIX}${userId}`,
      JSON.stringify(normalized),
    );
  } catch (error) {
    console.warn('[SocialAuth][Apple] Failed to cache profile in storage', error);
  }
};

const extractAdditionalAppleProfile = (
  userCredential: FirebaseAuthTypes.UserCredential,
): {firstName?: string | null; lastName?: string | null; email?: string | null} => {
  const profile: Record<string, any> = userCredential.additionalUserInfo?.profile ?? {};
  console.log('[SocialAuth][Apple] additionalUserInfo.profile', profile);
  const nameFromProfile =
    profile.name ??
    profile.fullName ??
    profile.full_name ??
    profile.displayName ??
    undefined;
  const parsedFromDisplayName = parseName(nameFromProfile);

  return {
    firstName:
      profile.givenName ??
      profile.given_name ??
      profile.firstName ??
      profile.first_name ??
      parsedFromDisplayName.firstName ??
      null,
    lastName:
      profile.familyName ??
      profile.family_name ??
      profile.lastName ??
      profile.last_name ??
      parsedFromDisplayName.lastName ??
      null,
    email: profile.email ?? null,
  };
};

const performGoogleSignIn = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
}> => {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

  try {
    await GoogleSignin.signOut();
  } catch (signOutError) {
    console.warn('[GoogleAuth] Unable to clear previous Google session', signOutError);
  }

  try {
    await GoogleSignin.signIn();
  } catch (err: any) {
    if (err?.code === GoogleStatusCodes.SIGN_IN_CANCELLED) {
      const e = new Error('Google sign-in cancelled');
      (e as any).code = 'auth/cancelled';
      throw e;
    }
    throw err;
  }
  let idToken: string | undefined;
  try {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens?.idToken ?? undefined;
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
  
  const googleCredential = GoogleAuthProvider.credential(idToken);
  const auth = getAuth();
  const userCredential = await signInWithCredential(auth, googleCredential);
  
  return {userCredential};
};

const performFacebookSignIn = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
}> => {
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

    const facebookCredential = FacebookAuthProvider.credential(
      authenticationToken,
      rawNonce,
    );
    const auth = getAuth();
    const userCredential = await signInWithCredential(auth, facebookCredential);

    return {userCredential};
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

  const facebookCredential = FacebookAuthProvider.credential(
    currentAccessToken.accessToken,
  );
  const auth = getAuth();
  const userCredential = await signInWithCredential(auth, facebookCredential);
  
  return {userCredential};
};

const signInWithAppleIOS = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}> => {
  console.log('[AppleAuth] Starting Apple sign-in (iOS)...');

  const appleAuthRequestResponse = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  console.log('[AppleAuth] Response', {
    user: appleAuthRequestResponse.user,
    email: appleAuthRequestResponse.email,
    fullName: appleAuthRequestResponse.fullName,
    realUserStatus: appleAuthRequestResponse.realUserStatus,
  });

  if (!appleAuthRequestResponse.identityToken) {
    throw new Error('Apple Sign-In failed - no identity token returned');
  }

  const {identityToken, nonce} = appleAuthRequestResponse;
  const appleCredential = AppleAuthProvider.credential(identityToken, nonce);

  const auth = getAuth();
  const userCredential = await signInWithCredential(auth, appleCredential);

  return {
    userCredential,
    firstName: appleAuthRequestResponse.fullName?.givenName ?? null,
    lastName: appleAuthRequestResponse.fullName?.familyName ?? null,
    email: appleAuthRequestResponse.email ?? null,
  };
};

const signInWithAppleAndroid = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}> => {
  if (!appleAuthAndroid.isSupported) {
    throw new Error('Apple sign-in requires Android API 19+.');
  }

  const {appleServiceId, appleRedirectUri} = PASSWORDLESS_AUTH_CONFIG ?? {};

  if (!appleServiceId || !appleRedirectUri) {
    throw new Error(
      '[AppleAuth] Missing appleServiceId or appleRedirectUri in PASSWORDLESS_AUTH_CONFIG.',
    );
  }

  console.log('[AppleAuth] Starting Apple sign-in (Android)...');

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

  const appleCredential = AppleAuthProvider.credential(idToken, rawNonce);

  const auth = getAuth();
  const userCredential = await signInWithCredential(auth, appleCredential);

  const firstName = (response as any)?.user?.name?.firstName ?? null;
  const lastName = (response as any)?.user?.name?.lastName ?? null;
  const email = (response as any)?.user?.email ?? null;

  console.log('[AppleAuth] Firebase sign-in successful (Android)', {
    uid: userCredential.user.uid,
    email: userCredential.user.email || email,
  });

  return {userCredential, firstName, lastName, email};
};

const signOutFirebaseIfNeeded = async () => {
  try {
    const auth = getAuth();
    if (auth.currentUser) {
      await auth.signOut();
    }
  } catch (error) {
    console.warn('[SocialAuth] Failed to clear Firebase session after cancellation', error);
  }
};

const mapAppleSignInError = (error: any): Error => {
  console.error('[AppleAuth] Error in performAppleSignIn:', {
    error,
    code: error?.code,
    message: error?.message,
  });

  if (error?.code === 'auth/invalid-credential') {
    return new Error(
      'Invalid Apple credentials. Check your Firebase and Apple configuration and try again.',
    );
  }

  if (error?.code === 'auth/account-exists-with-different-credential') {
    return new Error(
      'An account already exists with the same email but different sign-in credentials.',
    );
  }

  if (error?.code === 'auth/missing-or-invalid-nonce') {
    return new Error(
      'Authentication failed due to an invalid nonce. Please try signing in again.',
    );
  }

  if (error?.code === 'auth/credential-already-in-use') {
    return new Error('This Apple account is already linked to another user.');
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

const performAppleSignIn = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}> => {
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


const resolveCredential = async (
  provider: SocialProvider,
): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
  metadata?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}> => {
  switch (provider) {
    case 'google':
      return performGoogleSignIn();
    case 'facebook':
      return performFacebookSignIn();
    case 'apple': {
      const {userCredential, firstName, lastName, email} = await performAppleSignIn();
      return {
        userCredential,
        metadata: {
          firstName,
          lastName,
          email,
        },
      };
    }
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
  firebaseUser: FirebaseAuthTypes.User;
  profile: ProfileStatus;
  resolvedDetails: ReturnType<typeof resolveDisplayInfo>;
}): User => {
  const {firebaseUser, profile, resolvedDetails} = params;
  const baseUser: User = {
    id: firebaseUser.uid,
    parentId: profile.parent?.id ?? undefined,
    email: resolvedDetails.email ?? '',
    firstName: resolvedDetails.firstName ?? undefined,
    lastName: resolvedDetails.lastName ?? undefined,
    profilePicture: resolvedDetails.avatarUrl ?? undefined,
    profileToken: profile.profileToken,
  };
  const userWithProfile = mergeUserWithParentProfile(baseUser, profile.parent);
  return {
    ...userWithProfile,
    profileCompleted: profile.isComplete ?? userWithProfile.profileCompleted,
  };
};

const logSocialLogin = (provider: SocialProvider, tokens: AuthTokens, user: User) => {
  console.log('╔════════════════════════════════════════╗');
  console.log(`║   FIREBASE - ${provider.toUpperCase()} LOGIN   ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('JWT (ID Token):', tokens.idToken);
  console.log('Access Token:', tokens.accessToken);
  console.log('User ID:', tokens.userId);
  console.log('Email:', user.email);
  console.log('Provider: firebase');
  console.log('═══════════════════════════════════════');
};

const determineErrorCode = (error: any): string | undefined => {
  if (typeof error?.code === 'string') {
    return error.code;
  }
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
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
      console.warn('[SocialAuth] Google sign-out after cancellation failed', googleSignOutError);
    }
  }
  await signOutFirebaseIfNeeded();

  const normalizedCode = determineErrorCode(error);
  if (normalizedCode === 'auth/cancelled') {
    console.log('[SocialAuth] Sign-in cancelled by user; suppressing error toast.');
    const cancelledError = new Error('auth/cancelled');
    (cancelledError as any).code = 'auth/cancelled';
    throw cancelledError;
  }

  console.error(`[SocialAuth] Error in signInWithSocialProvider (${provider}):`, {
    error,
    message: error?.message,
    code: error?.code,
  });
  throw (error instanceof Error ? error : new Error(String(error ?? 'Social sign-in failed')));
};

export const signInWithSocialProvider = async (
  provider: SocialProvider,
): Promise<SocialAuthResult> => {
  try {
    console.log(`[SocialAuth] Starting ${provider} sign-in...`);
    const {userCredential, metadata: rawMetadata} = await resolveCredential(provider);
    const firebaseUser = userCredential.user;
    let metadata = rawMetadata;

    if (provider === 'apple') {
      const additionalProfile = extractAdditionalAppleProfile(userCredential);
      const cached = await getCachedAppleProfile(firebaseUser.uid);
      const displayNameParts = parseName(firebaseUser.displayName);

      metadata = {
        firstName:
          metadata?.firstName ??
          additionalProfile.firstName ??
          cached?.firstName ??
          displayNameParts.firstName ??
          null,
        lastName:
          metadata?.lastName ??
          additionalProfile.lastName ??
          cached?.lastName ??
          displayNameParts.lastName ??
          null,
        email:
          metadata?.email ??
          additionalProfile.email ??
          cached?.email ??
          firebaseUser.email ??
          null,
      };

      // Persist any available apple identity details for future logins
      await cacheAppleProfile(firebaseUser.uid, {
        firstName: metadata.firstName ?? cached?.firstName ?? null,
        lastName: metadata.lastName ?? cached?.lastName ?? null,
        email: metadata.email ?? cached?.email ?? firebaseUser.email ?? null,
      });

      console.log('[SocialAuth][Apple] Additional profile', {
        additionalProfile,
        cached,
        displayName: firebaseUser.displayName,
        mergedMetadata: metadata,
      });
    }

    if (!firebaseUser.email && !metadata?.email) {
      throw new Error(
        'We could not retrieve your email address from the selected provider. Please allow email access and try again.',
      );
    }

    const tokens = await buildTokens(firebaseUser);
    const resolvedDetails = resolveDisplayInfo(firebaseUser, provider, metadata);
    if (
      provider === 'apple' &&
      (metadata?.firstName || metadata?.lastName) &&
      !firebaseUser.displayName
    ) {
      try {
        const displayName = [metadata.firstName, metadata.lastName].filter(Boolean).join(' ').trim();
        if (displayName.length > 0) {
          await updateProfile(firebaseUser, {displayName});
          console.log('[SocialAuth][Apple] Set Firebase displayName from Apple metadata', {
            displayName,
          });
        }
      } catch (error) {
        console.warn('[SocialAuth][Apple] Failed to set Firebase displayName', error);
      }
    }

    let authSync: AuthSyncResult | undefined;
    try {
      authSync = await syncAuthUser({
        authToken: tokens.accessToken,
        idToken: tokens.idToken,
      });
    } catch (error) {
      console.warn('[SocialAuth] Failed to sync auth user, proceeding with default profile', error);
    }

    const profile = mapProfileFromAuthSync(authSync);
    const user = buildUserFromProfile({firebaseUser, profile, resolvedDetails});
    const completeTokens: AuthTokens = {...tokens, provider: 'firebase'};
    const initialFirstName = user.firstName ?? metadata?.firstName ?? undefined;
    const initialLastName = user.lastName ?? metadata?.lastName ?? undefined;
    if (provider === 'apple') {
      console.log('[SocialAuth][Apple] Prefill debug', {
        metadata,
        resolvedDetails,
        initialFirstName,
        initialLastName,
        email: resolvedDetails.email ?? firebaseUser.email,
      });
    }

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
