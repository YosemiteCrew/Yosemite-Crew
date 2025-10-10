import 'react-native-get-random-values';
import {Platform} from 'react-native';
import { v4 as uuid } from 'uuid'
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  FacebookAuthProvider,
  AppleAuthProvider,
} from '@react-native-firebase/auth';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {appleAuth,appleAuthAndroid} from '@invertase/react-native-apple-authentication';
import {LoginManager, AccessToken, Settings} from 'react-native-fbsdk-next';
import {PASSWORDLESS_AUTH_CONFIG} from '@/config/variables';
import {
  bootstrapProfile,
  fetchProfileStatus,
  type ProfileStatus,
} from '@/services/profile/profileService';
import type {User, AuthTokens} from '@/contexts/AuthContext';

export type SocialProvider = 'google' | 'facebook' | 'apple';

export interface SocialAuthResult {
  user: User;
  tokens: AuthTokens;
  profile: ProfileStatus;
  initialAttributes: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phone?: string;
    profilePicture?: string;
  };
}

let providersConfigured = false;

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
  const idToken = await user.getIdToken(true);
  const idTokenResult = await user.getIdTokenResult();
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

const performGoogleSignIn = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
}> => {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
  await GoogleSignin.signIn();
  const {idToken} = await GoogleSignin.getTokens();
  
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
  const loginResult = await LoginManager.logInWithPermissions([
    'public_profile',
    'email',
  ]);

  if (loginResult.isCancelled) {
    throw new Error('Facebook sign-in was cancelled.');
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

const performAppleSignIn = async (): Promise<{
  userCredential: FirebaseAuthTypes.UserCredential;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}> => {
  try {
    if (Platform.OS === 'ios') {
      // ---------- iOS (native) ----------
      console.log('[AppleAuth] Starting Apple sign-in (iOS)...');

      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token returned');
      }

      // Apple returns a nonce when you requested one; RNFirebase expects the raw nonce here
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
    }

    if (Platform.OS === 'android') {
      // ---------- Android (web flow via Custom Tabs) ----------
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

      // Generate secure random values
      const rawNonce = uuid();
      const state = uuid();

      // Configure request (Service ID + Return URL MUST match Apple Developer settings)
      appleAuthAndroid.configure({
        clientId: appleServiceId,                             // Services ID (web client_id)
        redirectUri: appleRedirectUri,                        // exact match; no query string
        responseType: appleAuthAndroid.ResponseType.ALL,      // request code + id_token
        scope: appleAuthAndroid.Scope.ALL,                    // name + email
        nonce: rawNonce,                                      // lib sha256-hashes before sending
        state,
      });

      // Launch Apple in Custom Tab and wait for result
      const response = await appleAuthAndroid.signIn();

      // NOTE: signIn() can return: code, id_token, user (first login only), state
      // id_token is what we need for Firebase
      const idToken = response?.id_token;
      if (!idToken) {
        throw new Error('Apple Sign-In failed - no id_token returned.');
      }

      // Build Firebase credential with id_token + RAW nonce
      const appleCredential = AppleAuthProvider.credential(idToken, rawNonce);

      const auth = getAuth();
      const userCredential = await signInWithCredential(auth, appleCredential);

      // Extract optional profile details if Apple returned them on first login
      const firstName = (response as any)?.user?.name?.firstName ?? null;
      const lastName = (response as any)?.user?.name?.lastName ?? null;
      const email = (response as any)?.user?.email ?? null;

      console.log('[AppleAuth] Firebase sign-in successful (Android)', {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email,
      });

      return {userCredential, firstName, lastName, email};
    }

    // Other platforms (e.g., web/desktop RN)
    throw new Error('Apple sign-in is not supported on this platform.');
  } catch (error: any) {
    console.error('[AppleAuth] Error in performAppleSignIn:', {
      error,
      code: error?.code,
      message: error?.message,
    });

    // Map common Apple / Firebase errors to friendly messages
    if (error?.code === 'auth/invalid-credential') {
      throw new Error(
        'Invalid Apple credentials. Check your Firebase and Apple configuration and try again.',
      );
    } else if (error?.code === 'auth/account-exists-with-different-credential') {
      throw new Error(
        'An account already exists with the same email but different sign-in credentials.',
      );
    } else if (error?.code === 'auth/missing-or-invalid-nonce') {
      throw new Error(
        'Authentication failed due to an invalid nonce. Please try signing in again.',
      );
    } else if (error?.code === 'auth/credential-already-in-use') {
      throw new Error('This Apple account is already linked to another user.');
    } else if (error?.message?.includes('invalid_client')) {
      throw new Error(
        'Apple configuration error (invalid_client). Verify Service ID, Key linkage to the Primary App ID, and exact redirect URL.',
      );
    } else if (error?.code === appleAuth.Error.CANCELED) {
      throw new Error('Apple sign-in was cancelled.');
    } else if (error?.code === appleAuth.Error.FAILED) {
      throw new Error('Apple sign-in failed. Please try again.');
    } else if (error?.code === appleAuth.Error.INVALID_RESPONSE) {
      throw new Error('Invalid response from Apple. Please try again.');
    } else if (error?.code === appleAuth.Error.NOT_HANDLED) {
      throw new Error('Apple sign-in is not supported on this device.');
    }

    throw error;
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
    case 'apple':
      return performAppleSignIn();
    default:
      throw new Error(`Unsupported social provider: ${provider}`);
  }
};

const ensureProfile = async (
  tokens: Pick<AuthTokens, 'accessToken' | 'userId'>,
  userDetails: {
    email?: string;
    firstName?: string;
    lastName?: string;
    provider: SocialProvider;
    avatarUrl?: string;
  },
): Promise<ProfileStatus> => {
  const profileStatus = await fetchProfileStatus({
    accessToken: tokens.accessToken,
    userId: tokens.userId ?? '',
    email: userDetails.email ?? '',
  });

  if (!profileStatus.exists) {
    const bootstrapResult = await bootstrapProfile({
      accessToken: tokens.accessToken,
      userId: tokens.userId ?? '',
      email: userDetails.email ?? '',
      provider: userDetails.provider,
      firstName: userDetails.firstName,
      lastName: userDetails.lastName,
      displayName: [userDetails.firstName, userDetails.lastName]
        .filter(Boolean)
        .join(' ') || undefined,
      avatarUrl: userDetails.avatarUrl,
    });

    if (bootstrapResult.profileToken) {
      return {
        exists: false,
        profileToken: bootstrapResult.profileToken,
        source: 'remote',
      };
    }
  }

  return profileStatus;
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

export const signInWithSocialProvider = async (
  provider: SocialProvider,
): Promise<SocialAuthResult> => {
  try {
    console.log(`[SocialAuth] Starting ${provider} sign-in...`);
    
    const {userCredential, metadata} = await resolveCredential(provider);
    const firebaseUser = userCredential.user;

    console.log(`[SocialAuth] ${provider} credential resolved:`, {
      uid: firebaseUser.uid,
      email: firebaseUser.email || metadata?.email,
      displayName: firebaseUser.displayName,
    });

    if (!firebaseUser.email && !metadata?.email) {
      throw new Error(
        'We could not retrieve your email address from the selected provider. Please allow email access and try again.',
      );
    }

    const tokens = await buildTokens(firebaseUser);
    const resolvedDetails = resolveDisplayInfo(firebaseUser, provider, metadata);

    const profile = await ensureProfile(
      {
        accessToken: tokens.accessToken,
        userId: tokens.userId,
      },
      resolvedDetails,
    );

    const user: User = {
      id: firebaseUser.uid,
      email: resolvedDetails.email ?? '',
      firstName: resolvedDetails.firstName ?? undefined,
      lastName: resolvedDetails.lastName ?? undefined,
      profilePicture: resolvedDetails.avatarUrl ?? undefined,
      profileToken: profile.profileToken,
    };

    const completeTokens: AuthTokens = {
      ...tokens,
      provider: 'firebase',
    };

    console.log(`[SocialAuth] ${provider} sign-in complete`);

    return {
      user,
      tokens: completeTokens,
      profile,
      initialAttributes: {
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  } catch (error: any) {
    console.error(`[SocialAuth] Error in signInWithSocialProvider (${provider}):`, {
      error,
      message: error?.message,
      code: error?.code,
    });
    throw error;
  }
};