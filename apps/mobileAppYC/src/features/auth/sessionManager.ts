import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, type AppStateStatus} from 'react-native';
import {
  getAuth,
  getIdToken,
  getIdTokenResult,
  reload,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {syncAuthUser} from '@/features/auth/services/authUserService';
import {fetchAuthSession, fetchUserAttributes, getCurrentUser} from 'aws-amplify/auth';
import {Buffer} from 'node:buffer';

import {PENDING_PROFILE_STORAGE_KEY} from '@/config/variables';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
  type StoredAuthTokens,
} from '@/features/auth/services/tokenStorage';
import {fetchProfileStatus, type ParentProfileSummary} from '@/features/account/services/profileService';
import {mergeUserWithParentProfile} from '@/features/auth/utils/parentProfileMapper';

import type {AuthProvider, NormalizedAuthTokens, User} from './types';

const LEGACY_AUTH_TOKEN_KEY = '@auth_tokens';
const USER_KEY = '@user_data';

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

  return decodeJwtExpiration(tokens.idToken) ?? decodeJwtExpiration(tokens.accessToken);
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

type PendingProfileResult = {kind: 'pendingProfile'};
type RecoveryResult = RecoverAuthOutcome | PendingProfileResult | null;

const resolveProfileTokenForUser = async (
  params: {
    existingProfileToken?: string | null;
    accessToken: string;
    userId: string;
    parentId?: string | null;
  },
  sourceLabel: 'Amplify' | 'Firebase',
): Promise<
  {
    status: 'resolved';
    token?: string | null;
    parent?: ParentProfileSummary;
    isComplete?: boolean;
  }
> => {
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
      `[Auth] Failed to resolve profile status during ${sourceLabel} refresh`,
      error,
    );
    return {status: 'resolved', token: params.existingProfileToken};
  }
};

const buildAmplifyUser = (
  authUser: Awaited<ReturnType<typeof getCurrentUser>>,
  mapped: Partial<User>,
  profileToken: string | null | undefined,
  parentSummary?: ParentProfileSummary,
): User => ({
  id: authUser.userId,
  parentId: parentSummary?.id ?? undefined,
  email: mapped.email ?? authUser.username,
  firstName: mapped.firstName,
  lastName: mapped.lastName,
  phone: mapped.phone,
  dateOfBirth: mapped.dateOfBirth,
  profilePicture: mapped.profilePicture,
  profileToken: profileToken ?? undefined,
});

const attemptAmplifyRecovery = async (
  existingProfileToken: string | null | undefined,
  maybeHandlePendingProfile: (userId: string) => Promise<boolean>,
  existingParentId?: string | null,
): Promise<RecoveryResult> => {
  try {
    const session = await fetchAuthSession({forceRefresh: true});
    const idToken = session.tokens?.idToken?.toString();
    const accessToken = session.tokens?.accessToken?.toString();

    if (!idToken || !accessToken) {
      return null;
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
    const profileTokenResult = await resolveProfileTokenForUser(
      {
        existingProfileToken,
        accessToken,
        userId: authUser.userId,
        parentId: existingParentId ?? undefined,
      },
      'Amplify',
    );

    const baseUser = buildAmplifyUser(
      authUser,
      mapped,
      profileTokenResult.token,
      profileTokenResult.parent,
    );
    const mergedUser = mergeUserWithParentProfile(baseUser, profileTokenResult.parent);
    const hydratedUser: User = {
      ...mergedUser,
      profileCompleted: profileTokenResult.isComplete ?? mergedUser.profileCompleted,
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
    return null;
  }
};

const attemptFirebaseRecovery = async (
  existingUser: User | null,
  existingProfileToken: string | null | undefined,
  maybeHandlePendingProfile: (userId: string) => Promise<boolean>,
): Promise<RecoveryResult> => {
  try {
    const auth = getAuth();
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      return null;
    }

    await reload(firebaseUser);

    if (await maybeHandlePendingProfile(firebaseUser.uid)) {
      return {kind: 'pendingProfile'};
    }

    const idToken = await getIdToken(firebaseUser);
    let authSync: Awaited<ReturnType<typeof syncAuthUser>> | undefined;
    try {
      authSync = await syncAuthUser({
        authToken: idToken,
        idToken,
      });
    } catch (error) {
      console.warn('[Auth] Failed to sync Firebase auth user during recovery', error);
    }

    const parentSummary = authSync?.parentSummary;

    // If we have no linked parent and no pending profile to resume, treat this
    // Firebase session as orphaned and sign out to avoid forcing CreateAccount.
    if (!parentSummary && !existingUser?.parentId) {
      try {
        await firebaseSignOut(auth);
      } catch (signOutError) {
        console.warn('[Auth] Firebase sign out failed during orphan recovery', signOutError);
      }
      await clearSessionData({clearPendingProfile: true});
      return null;
    }

    const profileTokenResult = parentSummary
      ? {
          status: 'resolved' as const,
          token: parentSummary.profileImageUrl ?? existingProfileToken,
          parent: parentSummary,
          isComplete: parentSummary.isComplete,
        }
      : await resolveProfileTokenForUser(
          {
            existingProfileToken,
            accessToken: idToken,
            userId: firebaseUser.uid,
            parentId: existingUser?.parentId ?? undefined,
          },
          'Firebase',
        );

    const tokenResult = await getIdTokenResult(firebaseUser);
    const expiresAt = tokenResult?.expirationTime
      ? new Date(tokenResult.expirationTime).getTime()
      : undefined;

    const baseUser: User = {
      id: firebaseUser.uid,
      parentId: profileTokenResult.parent?.id ?? existingUser?.parentId,
      email: firebaseUser.email ?? existingUser?.email ?? '',
      firstName: parentSummary?.firstName ?? existingUser?.firstName,
      lastName: parentSummary?.lastName ?? existingUser?.lastName,
      phone: existingUser?.phone,
      dateOfBirth: existingUser?.dateOfBirth,
      profilePicture:
        parentSummary?.profileImageUrl ??
        existingUser?.profilePicture ??
        firebaseUser.photoURL ??
        undefined,
      profileToken: profileTokenResult.token ?? existingProfileToken ?? undefined,
      address: existingUser?.address,
    };
    const mergedUser = mergeUserWithParentProfile(baseUser, profileTokenResult.parent);
    const hydratedUser: User = {
      ...mergedUser,
      profileCompleted: profileTokenResult.isComplete ?? mergedUser.profileCompleted,
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
  } catch (error) {
    console.warn(
      'No Firebase session detected during refresh. Falling back to stored values.',
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
        console.error('Failed to migrate legacy auth tokens into secure storage', migrateError);
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
      provider: storedTokens.provider ?? 'amplify',
    },
    storedTokens.userId ?? existingUser.id,
  );

  if (isTokenExpired(normalizedTokens.expiresAt)) {
    console.warn('[Auth] Stored tokens are expired; skipping cached session recovery.');
    return null;
  }

  return {
    kind: 'authenticated',
    user: {
      ...existingUser,
      profileToken: existingUser.profileToken ?? existingProfileToken ?? undefined,
    },
    tokens: normalizedTokens,
    provider: normalizedTokens.provider,
  };
};

export const getFreshStoredTokens = async (): Promise<NormalizedAuthTokens | null> => {
  const storedTokens = await loadStoredTokens();

  if (!storedTokens) {
    return null;
  }

  const normalized = normalizeTokens(
    {
      ...storedTokens,
      userId: storedTokens.userId ?? '',
      provider: storedTokens.provider ?? 'amplify',
    },
    storedTokens.userId ?? '',
  );

  if (!isTokenExpired(normalized.expiresAt)) {
    return normalized;
  }

  try {
    if (normalized.provider === 'firebase') {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        return null;
      }

      await reload(firebaseUser);
      const idToken = await getIdToken(firebaseUser, true);
      const tokenResult = await getIdTokenResult(firebaseUser, true);
      const refreshed: StoredAuthTokens = {
        idToken,
        accessToken: idToken,
        refreshToken: undefined,
        expiresAt: tokenResult?.expirationTime
          ? new Date(tokenResult.expirationTime).getTime()
          : undefined,
        userId: firebaseUser.uid,
        provider: 'firebase',
      };

      await storeTokens(refreshed);
      markAuthRefreshed();
      return normalizeTokens(refreshed, firebaseUser.uid, 'firebase');
    }

    const session = await fetchAuthSession({forceRefresh: true});
    const idToken = session.tokens?.idToken?.toString();
    const accessToken = session.tokens?.accessToken?.toString();

    if (!idToken || !accessToken) {
      return null;
    }

    const expiresAtSeconds =
      session.tokens?.idToken?.payload?.exp ??
      session.tokens?.accessToken?.payload?.exp ??
      undefined;

    let resolvedUserId = normalized.userId;
    if (!resolvedUserId) {
      try {
        const authUser = await getCurrentUser();
        resolvedUserId = authUser.userId;
      } catch {
        resolvedUserId = storedTokens.userId ?? '';
      }
    }

    const refreshed: StoredAuthTokens = {
      idToken,
      accessToken,
      refreshToken: undefined,
      expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
      userId: resolvedUserId,
      provider: 'amplify',
    };

    await storeTokens(refreshed);
    markAuthRefreshed();
    return normalizeTokens(refreshed, resolvedUserId ?? '', 'amplify');
  } catch (error) {
    console.warn('[Auth] Unable to refresh stored tokens from provider', error);
    return normalized;
  }
};

export const recoverAuthSession = async (): Promise<RecoverAuthOutcome> => {
  const existingUserRaw = await AsyncStorage.getItem(USER_KEY);
  const existingUser = existingUserRaw ? (JSON.parse(existingUserRaw) as User) : null;
  const existingProfileToken = existingUser?.profileToken;

  const maybeHandlePendingProfile = async (userId: string) => {
    const pending = await checkPendingProfile(userId);
    return pending === 'pending';
  };
  const amplifyResult = await attemptAmplifyRecovery(
    existingProfileToken,
    maybeHandlePendingProfile,
    existingUser?.parentId ?? undefined,
  );
  if (amplifyResult) {
    return amplifyResult;
  }

  const firebaseResult = await attemptFirebaseRecovery(
    existingUser,
    existingProfileToken,
    maybeHandlePendingProfile,
  );
  if (firebaseResult) {
    return firebaseResult;
  }

  const storedTokensResult = await recoverFromStoredTokens(
    existingUser,
    existingProfileToken,
  );
  if (storedTokensResult) {
    if (storedTokensResult.kind === 'authenticated') {
      if (await maybeHandlePendingProfile(storedTokensResult.user.id)) {
        return {kind: 'pendingProfile'};
      }
    }
    return storedTokensResult;
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
