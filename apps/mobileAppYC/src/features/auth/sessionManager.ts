import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, DeviceEventEmitter, type AppStateStatus} from 'react-native';
import SuperTokens from 'supertokens-react-native';
import {Buffer} from 'node:buffer';

import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
  type StoredAuthTokens,
} from '@/features/auth/services/tokenStorage';
import {
  fetchProfileStatus,
  type ParentProfileSummary,
} from '@/features/account/services/profileService';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';

import type {AuthProvider, NormalizedAuthTokens, User} from './types';

const LEGACY_AUTH_TOKEN_KEY = '@auth_tokens';
const USER_KEY = '@user_data';
export const DEMO_API_MODE_KEY = '@demo_api_mode';

export const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes
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

    const normalized = payloadSegment.replaceAll('-', '+').replaceAll('_', '/');
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

export const resolveExpiration = (tokens: {
  expiresAt?: number;
  idToken?: string;
  accessToken?: string;
}): number | undefined => {
  if (tokens.expiresAt) {
    return tokens.expiresAt;
  }

  return (
    decodeJwtExpiration(tokens.idToken) ??
    decodeJwtExpiration(tokens.accessToken)
  );
};

export const isTokenExpired = (
  expiresAt?: number | null,
  bufferMs: number = REFRESH_BUFFER_MS,
): boolean => {
  if (!expiresAt) {
    return false;
  }

  return expiresAt - bufferMs <= Date.now();
};

const parseLegacyTokens = (raw: string | null): StoredAuthTokens | null => {
  if (!raw) {
    return null;
  }

  try {
    const tokens = JSON.parse(raw) as StoredAuthTokens;
    if (tokens.provider !== 'supertokens') {
      // Pre-cutover Amplify/Firebase fallback tokens cannot be recovered.
      return null;
    }
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
  const provider = providerOverride ?? tokens.provider ?? 'supertokens';

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
      provider: rawTokens.provider ?? 'supertokens',
    },
    rawTokens.userId ?? user.id,
  );

  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

  try {
    await storeTokens({...normalizedTokens, email: user.email});
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
      console.error(
        'Failed to persist auth tokens to legacy storage',
        fallbackError,
      );
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
  const keys = [USER_KEY, LEGACY_AUTH_TOKEN_KEY, DEMO_API_MODE_KEY];

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

const checkPendingProfile = async (
  userId: string,
): Promise<MaybePendingProfile> => {
  const pendingProfileRaw = await AsyncStorage.getItem(
    PENDING_PROFILE_STORAGE_KEY,
  );
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

const isProfileComplete = (user?: User | null): boolean => {
  return Boolean(user?.parentId || user?.profileCompleted);
};

const clearPendingProfileForUser = async (userId: string) => {
  if (!userId) {
    return;
  }

  try {
    const pendingProfileRaw = await AsyncStorage.getItem(
      PENDING_PROFILE_STORAGE_KEY,
    );
    if (!pendingProfileRaw) {
      return;
    }

    const pendingProfile = JSON.parse(pendingProfileRaw) as {userId?: string};
    if (pendingProfile?.userId !== userId) {
      return;
    }

    await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
    DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
  } catch (error) {
    console.warn('[Auth] Failed to clear pending profile payload', error);
  }
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

type PendingProfileResult = {kind: 'pendingProfile'};
type RecoveryResult = RecoverAuthOutcome | PendingProfileResult | null;

const resolveProfileTokenForUser = async (params: {
  existingProfileToken?: string | null;
  accessToken: string;
  userId: string;
  parentId?: string | null;
}): Promise<{
  status: 'resolved';
  token?: string | null;
  parent?: ParentProfileSummary;
  isComplete?: boolean;
}> => {
  try {
    const profileStatus = await fetchProfileStatus({
      accessToken: params.accessToken,
      userId: params.userId,
      parentId: params.parentId ?? undefined,
    });

    return {
      status: 'resolved',
      token: profileStatus.profileToken ?? params.existingProfileToken,
      parent: profileStatus.parent,
      isComplete: profileStatus.isComplete,
    };
  } catch (error) {
    console.warn(
      '[Auth] Failed to resolve profile status during SuperTokens refresh',
      error,
    );
    return {status: 'resolved', token: params.existingProfileToken};
  }
};

const resolveSuperTokensUserId = async (
  fallbackUserId?: string | null,
): Promise<string | undefined> => {
  try {
    return await SuperTokens.getUserId();
  } catch (error) {
    console.warn('[Auth] Unable to read SuperTokens user id', error);
    return fallbackUserId ?? undefined;
  }
};

const attemptSuperTokensRecovery = async (
  existingUser: User | null,
  existingProfileToken: string | null | undefined,
): Promise<RecoveryResult> => {
  try {
    const sessionExists = await SuperTokens.doesSessionExist();
    if (!sessionExists) {
      return null;
    }

    // getAccessToken transparently refreshes the token when needed.
    const accessToken = await SuperTokens.getAccessToken();
    if (!accessToken) {
      return null;
    }

    const userId = await resolveSuperTokensUserId(existingUser?.id);
    if (!userId) {
      return null;
    }

    console.log('[Auth] Found valid SuperTokens session during recovery');

    const pendingProfileStatus = await checkPendingProfile(userId);

    const profileTokenResult = await resolveProfileTokenForUser({
      existingProfileToken,
      accessToken,
      userId,
      parentId: existingUser?.parentId ?? undefined,
    });

    // A session without a linked parent, local profile, or pending signup is
    // orphaned — sign out instead of forcing the CreateAccount flow.
    if (
      !profileTokenResult.parent &&
      !existingUser?.parentId &&
      pendingProfileStatus !== 'pending'
    ) {
      try {
        await SuperTokens.signOut();
      } catch (signOutError) {
        console.warn(
          '[Auth] SuperTokens sign out failed during orphan recovery',
          signOutError,
        );
      }
      await clearSessionData({clearPendingProfile: true});
      return null;
    }

    const baseUser: User = {
      id: userId,
      parentId: profileTokenResult.parent?.id ?? existingUser?.parentId,
      email: existingUser?.email ?? '',
      firstName: existingUser?.firstName,
      lastName: existingUser?.lastName,
      phone: existingUser?.phone,
      dateOfBirth: existingUser?.dateOfBirth,
      profilePicture: existingUser?.profilePicture,
      profileToken:
        profileTokenResult.token ?? existingProfileToken ?? undefined,
      address: existingUser?.address,
    };
    const mergedUser = mergeUserWithParentProfile(
      baseUser,
      profileTokenResult.parent,
    );
    const hydratedUser: User = {
      ...mergedUser,
      profileCompleted:
        profileTokenResult.isComplete ?? mergedUser.profileCompleted,
    };

    if (pendingProfileStatus === 'pending') {
      if (isProfileComplete(hydratedUser)) {
        await clearPendingProfileForUser(userId);
      } else {
        return {kind: 'pendingProfile'};
      }
    }

    const normalizedTokens = normalizeTokens(
      {
        idToken: accessToken,
        accessToken,
        refreshToken: undefined,
        expiresAt: resolveExpiration({accessToken}),
        userId,
        provider: 'supertokens',
      },
      userId,
      'supertokens',
    );

    return {
      kind: 'authenticated',
      user: hydratedUser,
      tokens: normalizedTokens,
      provider: 'supertokens',
    };
  } catch (error) {
    console.warn(
      'No SuperTokens session detected during recovery. Falling back to stored values.',
      error,
    );
    return null;
  }
};

const recoverFromStoredTokens = async (
  existingUser: User | null,
  existingProfileToken: string | null | undefined,
): Promise<RecoveryResult> => {
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
        console.error(
          'Failed to migrate legacy auth tokens into secure storage',
          migrateError,
        );
      }

      await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
  }

  if (!existingUser || !storedTokens) {
    return null;
  }

  const normalizedTokens = normalizeTokens(
    {
      ...storedTokens,
      userId: storedTokens.userId ?? existingUser.id,
      provider: storedTokens.provider ?? 'supertokens',
    },
    storedTokens.userId ?? existingUser.id,
  );

  if (isTokenExpired(normalizedTokens.expiresAt)) {
    console.warn(
      '[Auth] Stored tokens are expired; skipping cached session recovery.',
    );
    return null;
  }

  return {
    kind: 'authenticated',
    user: {
      ...existingUser,
      profileToken:
        existingUser.profileToken ?? existingProfileToken ?? undefined,
    },
    tokens: normalizedTokens,
    provider: normalizedTokens.provider,
  };
};

export const getFreshStoredTokens =
  async (): Promise<NormalizedAuthTokens | null> => {
    const storedTokens = await loadStoredTokens();

    if (!storedTokens) {
      return null;
    }

    const normalized = normalizeTokens(
      {
        ...storedTokens,
        userId: storedTokens.userId ?? '',
        provider: 'supertokens',
      },
      storedTokens.userId ?? '',
    );

    if (!isTokenExpired(normalized.expiresAt)) {
      return normalized;
    }

    try {
      // The SuperTokens SDK refreshes the session automatically when the
      // access token has expired.
      const accessToken = await SuperTokens.getAccessToken();
      if (!accessToken) {
        return null;
      }

      const refreshed: StoredAuthTokens = {
        ...storedTokens,
        idToken: accessToken,
        accessToken,
        refreshToken: undefined,
        expiresAt: resolveExpiration({accessToken}),
        provider: 'supertokens',
      };

      await storeTokens(refreshed);
      markAuthRefreshed();
      return normalizeTokens(
        refreshed,
        storedTokens.userId ?? '',
        'supertokens',
      );
    } catch (error) {
      console.warn(
        '[Auth] Unable to refresh SuperTokens session tokens',
        error,
      );
      return normalized;
    }
  };

export const recoverAuthSession = async (): Promise<RecoverAuthOutcome> => {
  const existingUserRaw = await AsyncStorage.getItem(USER_KEY);
  const existingUser = existingUserRaw
    ? (JSON.parse(existingUserRaw) as User)
    : null;
  const existingProfileToken = existingUser?.profileToken;

  const superTokensResult = await attemptSuperTokensRecovery(
    existingUser,
    existingProfileToken,
  );
  if (superTokensResult) {
    return superTokensResult;
  }

  const storedTokensResult = await recoverFromStoredTokens(
    existingUser,
    existingProfileToken,
  );
  if (storedTokensResult) {
    if (storedTokensResult.kind === 'authenticated') {
      const pendingProfileStatus = await checkPendingProfile(
        storedTokensResult.user.id,
      );
      if (pendingProfileStatus === 'pending') {
        if (isProfileComplete(storedTokensResult.user)) {
          await clearPendingProfileForUser(storedTokensResult.user.id);
        } else {
          return {kind: 'pendingProfile'};
        }
      }
    }
    return storedTokensResult;
  }

  await clearSessionData();
  return {kind: 'unauthenticated'};
};

let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;
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
    const safeCandidate = Number.isFinite(candidate)
      ? candidate
      : DEFAULT_REFRESH_INTERVAL_MS;
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

  appStateSubscription = AppState.addEventListener(
    'change',
    (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        const now = Date.now();
        if (now - lastRefreshTimestamp > MIN_APPSTATE_REFRESH_MS) {
          markAuthRefreshed(now);
          refreshCallback();
        }
      }
    },
  );
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
