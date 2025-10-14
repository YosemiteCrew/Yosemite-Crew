import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, type AppStateStatus} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import {fetchAuthSession, fetchUserAttributes, getCurrentUser} from 'aws-amplify/auth';
import {Buffer} from 'buffer';

import {PENDING_PROFILE_STORAGE_KEY} from '@/config/variables';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
  type StoredAuthTokens,
} from '@/services/auth/tokenStorage';
import {fetchProfileStatus} from '@/services/profile/profileService';

import type {AuthProvider, NormalizedAuthTokens, User} from './types';

const LEGACY_AUTH_TOKEN_KEY = '@auth_tokens';
const USER_KEY = '@user_data';

const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes
const DEFAULT_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours fallback
const MAX_REFRESH_DELAY_MS = 12 * 60 * 60 * 1000; // 12 hours clamp
const MIN_APPSTATE_REFRESH_MS = 60 * 1000; // 1 minute

const decodeJwtExpiration = (token?: string): number | undefined => {
  if (!token) {
    return undefined;
  }

  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return undefined;
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded) as {exp?: number};
    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  } catch (error) {
    console.warn('Failed to decode JWT expiration', error);
    return undefined;
  }
};

const resolveExpiration = (tokens: {
  expiresAt?: number;
  idToken?: string;
  accessToken?: string;
}): number | undefined => {
  if (tokens.expiresAt) {
    return tokens.expiresAt;
  }

  return decodeJwtExpiration(tokens.idToken) ?? decodeJwtExpiration(tokens.accessToken);
};

const mapAttributesToUser = (
  attributes: Record<string, string | undefined>,
): Partial<User> => ({
  email: attributes.email ?? '',
  firstName: attributes.given_name,
  lastName: attributes.family_name,
  phone: attributes.phone_number,
  dateOfBirth: attributes.birthdate,
  profilePicture: attributes.picture,
});

const parseLegacyTokens = (raw: string | null): StoredAuthTokens | null => {
  if (!raw) {
    return null;
  }

  try {
    const tokens = JSON.parse(raw) as StoredAuthTokens;
    const expiresAt = resolveExpiration(tokens);
    return {
      ...tokens,
      expiresAt,
    };
  } catch (error) {
    console.warn('Failed to parse stored auth tokens', error);
    return null;
  }
};

const normalizeTokens = (
  tokens: StoredAuthTokens,
  userId: string,
  providerOverride?: AuthProvider,
): NormalizedAuthTokens => {
  const provider = providerOverride ?? tokens.provider ?? 'amplify';

  return {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: resolveExpiration(tokens),
    userId,
    provider,
  };
};

export const persistSessionData = async (
  user: User,
  rawTokens: StoredAuthTokens,
): Promise<NormalizedAuthTokens> => {
  const normalizedTokens = normalizeTokens(
    {
      ...rawTokens,
      userId: rawTokens.userId ?? user.id,
      provider: rawTokens.provider ?? 'amplify',
    },
    rawTokens.userId ?? user.id,
  );

  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

  try {
    await storeTokens(normalizedTokens);
    await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to persist auth tokens securely', error);
    // Fallback: persist tokens to AsyncStorage so session recovers on next launch.
    // recoverAuthSession() will migrate these to secure storage when available.
    try {
      await AsyncStorage.setItem(
        LEGACY_AUTH_TOKEN_KEY,
        JSON.stringify({
          idToken: normalizedTokens.idToken,
          accessToken: normalizedTokens.accessToken,
          refreshToken: normalizedTokens.refreshToken,
          expiresAt: normalizedTokens.expiresAt,
          userId: normalizedTokens.userId,
          provider: normalizedTokens.provider,
        }),
      );
    } catch (fallbackError) {
      console.error('Failed to persist auth tokens to legacy storage', fallbackError);
    }
  }

  return normalizedTokens;
};

export const persistUserData = async (user: User) => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSessionData = async ({
  clearPendingProfile = false,
}: {clearPendingProfile?: boolean} = {}) => {
  const keys = [USER_KEY, LEGACY_AUTH_TOKEN_KEY];

  if (clearPendingProfile) {
    keys.push(PENDING_PROFILE_STORAGE_KEY);
  }

  await AsyncStorage.multiRemove(keys);

  try {
    await clearStoredTokens();
  } catch (error) {
    console.error('Failed to clear secure auth tokens', error);
  }
};

type MaybePendingProfile = 'none' | 'pending';

const checkPendingProfile = async (userId: string): Promise<MaybePendingProfile> => {
  const pendingProfileRaw = await AsyncStorage.getItem(PENDING_PROFILE_STORAGE_KEY);
  if (!pendingProfileRaw) {
    return 'none';
  }

  try {
    const pendingProfile = JSON.parse(pendingProfileRaw) as {userId?: string};
    if (pendingProfile?.userId === userId) {
      return 'pending';
    }
  } catch (error) {
    console.warn('[Auth] Failed to parse pending profile payload', error);
  }

  return 'none';
};

export type RecoverAuthOutcome =
  | {
      kind: 'authenticated';
      user: User;
      tokens: NormalizedAuthTokens;
      provider: AuthProvider;
    }
  | {kind: 'pendingProfile'}
  | {kind: 'unauthenticated'};

export const recoverAuthSession = async (): Promise<RecoverAuthOutcome> => {
  const existingUserRaw = await AsyncStorage.getItem(USER_KEY);
  const existingUser = existingUserRaw ? (JSON.parse(existingUserRaw) as User) : null;
  const existingProfileToken = existingUser?.profileToken;

  const maybeHandlePendingProfile = async (userId: string) => {
    const pending = await checkPendingProfile(userId);
    return pending === 'pending';
  };

  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    const accessToken = session.tokens?.accessToken?.toString();

    if (!idToken || !accessToken) {
      throw new Error('No valid tokens in session');
    }

    console.log('[Auth] Found valid Amplify session during recovery');

    const [authUser, attributes] = await Promise.all([
      getCurrentUser(),
      fetchUserAttributes(),
    ]);

    if (await maybeHandlePendingProfile(authUser.userId)) {
      return {kind: 'pendingProfile'};
    }

    const mapped = mapAttributesToUser(attributes);
    let profileToken = existingProfileToken;

    if (!profileToken) {
      try {
        const profileStatus = await fetchProfileStatus({
          accessToken,
          userId: authUser.userId,
          email: mapped.email ?? authUser.username,
        });

        if (!profileStatus.exists && profileStatus.source === 'remote') {
          return {kind: 'pendingProfile'};
        }

        profileToken = profileStatus.profileToken;
      } catch (profileError) {
        console.warn(
          '[Auth] Failed to resolve profile status during Amplify refresh',
          profileError,
        );
      }
    }

    const hydratedUser: User = {
      id: authUser.userId,
      email: mapped.email ?? authUser.username,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      phone: mapped.phone,
      dateOfBirth: mapped.dateOfBirth,
      profilePicture: mapped.profilePicture,
      profileToken,
    };

    const expiresAtSeconds =
      session.tokens?.idToken?.payload?.exp ??
      session.tokens?.accessToken?.payload?.exp ??
      undefined;

    const normalizedTokens = normalizeTokens(
      {
        idToken,
        accessToken,
        refreshToken: undefined,
        expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
        userId: authUser.userId,
        provider: 'amplify',
      },
      authUser.userId,
      'amplify',
    );

    return {
      kind: 'authenticated',
      user: hydratedUser,
      tokens: normalizedTokens,
      provider: 'amplify',
    };
  } catch (error) {
    console.log('No active Amplify session detected; checking Firebase session.', error);
  }

  try {
    const auth = getAuth();
    const firebaseUser = auth.currentUser;

    if (firebaseUser) {
      await firebaseUser.reload();

      if (await maybeHandlePendingProfile(firebaseUser.uid)) {
        return {kind: 'pendingProfile'};
      }

      let profileToken = existingProfileToken;

      if (!profileToken) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const profileStatus = await fetchProfileStatus({
            accessToken: idToken,
            userId: firebaseUser.uid,
            email: firebaseUser.email ?? existingUser?.email ?? '',
          });

          if (!profileStatus.exists && profileStatus.source === 'remote') {
            return {kind: 'pendingProfile'};
          }

          profileToken = profileStatus.profileToken;
        } catch (profileError) {
          console.warn(
            '[Auth] Failed to resolve profile status during Firebase refresh',
            profileError,
          );
        }
      }

      const idToken = await firebaseUser.getIdToken();
      const tokenResult = await firebaseUser.getIdTokenResult();
      const expiresAt = tokenResult?.expirationTime
        ? new Date(tokenResult.expirationTime).getTime()
        : undefined;

      const hydratedUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? existingUser?.email ?? '',
        firstName: existingUser?.firstName,
        lastName: existingUser?.lastName,
        phone: existingUser?.phone,
        dateOfBirth: existingUser?.dateOfBirth,
        profilePicture: existingUser?.profilePicture ?? firebaseUser.photoURL ?? undefined,
        profileToken: profileToken ?? existingProfileToken,
      };

      const normalizedTokens = normalizeTokens(
        {
          idToken,
          accessToken: idToken,
          expiresAt,
          userId: firebaseUser.uid,
          provider: 'firebase',
        },
        firebaseUser.uid,
        'firebase',
      );

      return {
        kind: 'authenticated',
        user: hydratedUser,
        tokens: normalizedTokens,
        provider: 'firebase',
      };
    }
  } catch (firebaseError) {
    console.warn(
      'No Firebase session detected during refresh. Falling back to stored values.',
      firebaseError,
    );
  }

  let storedTokens = await loadStoredTokens();

  if (!storedTokens) {
    const legacyTokenRaw = await AsyncStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    const legacyTokens = parseLegacyTokens(legacyTokenRaw);

    if (legacyTokens) {
      storedTokens = legacyTokens;

      try {
        await storeTokens({
          ...legacyTokens,
          userId: legacyTokens.userId ?? existingUser?.id,
        });
      } catch (migrateError) {
        console.error('Failed to migrate legacy auth tokens into secure storage', migrateError);
      }

      await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
  }

  if (existingUser && storedTokens) {
    if (await maybeHandlePendingProfile(existingUser.id)) {
      return {kind: 'pendingProfile'};
    }

    const normalizedTokens = normalizeTokens(
      {
        ...storedTokens,
        userId: storedTokens.userId ?? existingUser.id,
        provider: storedTokens.provider ?? 'amplify',
      },
      storedTokens.userId ?? existingUser.id,
    );

    return {
      kind: 'authenticated',
      user: existingUser,
      tokens: normalizedTokens,
      provider: normalizedTokens.provider,
    };
  }

  await clearSessionData();
  return {kind: 'unauthenticated'};
};

let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let lastRefreshTimestamp = 0;

const clearRefreshTimeout = () => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
};

export const markAuthRefreshed = (timestamp: number = Date.now()) => {
  lastRefreshTimestamp = timestamp;
};

export const scheduleSessionRefresh = (
  expiresAt: number | undefined,
  refreshCallback: () => void,
) => {
  clearRefreshTimeout();

  const now = Date.now();
  let delay = DEFAULT_REFRESH_INTERVAL_MS;

  if (expiresAt) {
    const candidate = expiresAt - now - REFRESH_BUFFER_MS;
    const safeCandidate = Number.isFinite(candidate) ? candidate : DEFAULT_REFRESH_INTERVAL_MS;
    delay = Math.max(REFRESH_BUFFER_MS, safeCandidate);
  }

  delay = Math.min(MAX_REFRESH_DELAY_MS, delay);

  refreshTimeout = setTimeout(() => {
    markAuthRefreshed();
    refreshCallback();
  }, delay);
};

export const registerAppStateListener = (refreshCallback: () => void) => {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', (nextStatus: AppStateStatus) => {
    if (nextStatus === 'active') {
      const now = Date.now();
      if (now - lastRefreshTimestamp > MIN_APPSTATE_REFRESH_MS) {
        markAuthRefreshed(now);
        refreshCallback();
      }
    }
  });
};

export const resetAuthLifecycle = ({clearPendingProfile = false} = {}) => {
  clearRefreshTimeout();
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  lastRefreshTimestamp = 0;

  if (clearPendingProfile) {
    AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY).catch(error =>
      console.warn('Failed to clear pending profile state', error),
    );
  }
};

export const getUserStorageKey = () => USER_KEY;
