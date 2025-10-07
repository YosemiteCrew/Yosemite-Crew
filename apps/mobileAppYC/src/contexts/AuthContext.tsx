import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {fetchAuthSession, fetchUserAttributes, getCurrentUser} from 'aws-amplify/auth';
import {signOutEverywhere} from '@/services/auth/passwordlessAuth';
import {fetchProfileStatus} from '@/services/profile/profileService';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
  type StoredAuthTokens,
} from '@/services/auth/tokenStorage';
import {Buffer} from 'buffer';
import { PENDING_PROFILE_STORAGE_KEY } from '@/constants/auth';

const LEGACY_AUTH_TOKEN_KEY = '@auth_tokens';
const USER_KEY = '@user_data';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  profilePicture?: string;
  profileToken?: string;
}

type AuthTokens = StoredAuthTokens;

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  login: (userData: User, tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
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
  return (
    decodeJwtExpiration(tokens.idToken) ?? decodeJwtExpiration(tokens.accessToken)
  );
};

const mapAttributesToUser = (attributes: Record<string, string | undefined>): Partial<User> => ({
  email: attributes.email ?? '',
  firstName: attributes.given_name,
  lastName: attributes.family_name,
  phone: attributes.phone_number,
  dateOfBirth: attributes.birthdate,
  profilePicture: attributes.picture,
});

const parseLegacyTokens = (raw: string | null): AuthTokens | null => {
  if (!raw) {
    return null;
  }

  try {
    const tokens = JSON.parse(raw) as AuthTokens;
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

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSessionRef = useRef<() => Promise<void>>(async () => undefined);
  const lastRefreshRef = useRef<number>(0);

  const scheduleSessionRefresh = useCallback((expiresAt?: number) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

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

    refreshTimeoutRef.current = setTimeout(() => {
      refreshSessionRef.current?.();
    }, delay);
  }, []);

  const saveSession = useCallback(
    async (userData: User, tokens: AuthTokens) => {
      const tokensWithExpiry: AuthTokens = {
        ...tokens,
        expiresAt: resolveExpiration(tokens),
      };

      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      try {
        await storeTokens(tokensWithExpiry);
        await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
      } catch (error) {
        console.error('Failed to persist auth tokens securely', error);
      }

      setUser(userData);
      setIsLoggedIn(true);
      lastRefreshRef.current = Date.now();
      scheduleSessionRefresh(tokensWithExpiry.expiresAt);
    },
    [scheduleSessionRefresh],
  );

  const refreshSession = useCallback(async () => {
    try {
      const existingUserSerialized = await AsyncStorage.getItem(USER_KEY);
      const existingProfileToken = existingUserSerialized
        ? ((JSON.parse(existingUserSerialized) as User).profileToken ?? undefined)
        : undefined;

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const accessToken = session.tokens?.accessToken?.toString();
      if (!idToken || !accessToken) {
        throw new Error('No valid tokens in session');
      }

      const [authUser, attributes] = await Promise.all([
        getCurrentUser(),
        fetchUserAttributes(),
      ]);

      const mapped = mapAttributesToUser(attributes);

      const expiresAtSeconds =
        session.tokens?.idToken?.payload?.exp ??
        session.tokens?.accessToken?.payload?.exp ??
        undefined;

      const pendingProfileRaw = await AsyncStorage.getItem(PENDING_PROFILE_STORAGE_KEY);

      if (pendingProfileRaw) {
        try {
          const pendingProfile = JSON.parse(pendingProfileRaw) as { userId?: string };
          if (pendingProfile?.userId === authUser.userId) {
            console.log('[AuthContext] Pending profile flag found during refresh, forcing create account', {
              userId: authUser.userId,
            });
            setUser(null);
            setIsLoggedIn(false);
            lastRefreshRef.current = Date.now();
            scheduleSessionRefresh(undefined);
            return;
          }
        } catch (parseError) {
          console.warn('[AuthContext] Failed to parse pending profile payload', parseError);
        }
      }

      let profileToken = existingProfileToken;

      if (!profileToken) {
        try {
          const profileStatus = await fetchProfileStatus({
            accessToken,
            userId: authUser.userId,
            email: mapped.email ?? authUser.username,
          });

          if (!profileStatus.exists && profileStatus.source === 'remote') {
            console.log(
              '[AuthContext] Remote profile lookup indicates missing profile, forcing create account',
              {
                userId: authUser.userId,
              },
            );
            setUser(null);
            setIsLoggedIn(false);
            lastRefreshRef.current = Date.now();
            scheduleSessionRefresh(undefined);
            return;
          }

          profileToken = profileStatus.profileToken;
        } catch (profileError) {
          console.warn('[AuthContext] Failed to resolve profile status during refresh', profileError);
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

      await saveSession(hydratedUser, {
        idToken,
        accessToken,
        refreshToken: undefined,
        expiresAt: expiresAtSeconds ? expiresAtSeconds * 1000 : undefined,
      });
    } catch (error) {
      console.log('No active Amplify session detected; falling back to stored values.', error);

      const storedUserRaw = await AsyncStorage.getItem(USER_KEY);
      const storedUser = storedUserRaw ? (JSON.parse(storedUserRaw) as User) : null;

      let storedTokens = await loadStoredTokens();

      if (!storedTokens) {
        const legacyTokenRaw = await AsyncStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
        const legacyTokens = parseLegacyTokens(legacyTokenRaw);
        if (legacyTokens) {
          storedTokens = legacyTokens;
          try {
            await storeTokens(legacyTokens);
          } catch (migrateError) {
            console.error('Failed to migrate legacy auth tokens into secure storage', migrateError);
          }
          await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        }
      }

      if (storedUser && storedTokens) {
        const pendingProfileRaw = await AsyncStorage.getItem(PENDING_PROFILE_STORAGE_KEY);
        if (pendingProfileRaw) {
          try {
            const pendingProfile = JSON.parse(pendingProfileRaw) as { userId?: string };
            if (pendingProfile?.userId === storedUser.id) {
              console.log('[AuthContext] Pending profile flag found when reading cached tokens', {
                userId: storedUser.id,
              });
              setUser(null);
              setIsLoggedIn(false);
              lastRefreshRef.current = Date.now();
              scheduleSessionRefresh(undefined);
              return;
            }
          } catch (parseError) {
            console.warn('[AuthContext] Failed to parse pending profile payload', parseError);
          }
        }
        const expiresAt = resolveExpiration(storedTokens);
        if (expiresAt && storedTokens.expiresAt !== expiresAt) {
          try {
            await storeTokens({...storedTokens, expiresAt});
          } catch (persistError) {
            console.error('Failed to persist token expiration metadata', persistError);
          }
          storedTokens.expiresAt = expiresAt;
        }
        setUser(storedUser);
        setIsLoggedIn(true);
        lastRefreshRef.current = Date.now();
        scheduleSessionRefresh(storedTokens.expiresAt);
      } else {
        setUser(null);
        setIsLoggedIn(false);
        await AsyncStorage.removeItem(USER_KEY);
        await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
        try {
          await clearStoredTokens();
        } catch (clearError) {
          console.error('Failed to clear secure auth tokens', clearError);
        }
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
        lastRefreshRef.current = 0;
      }
    }
  }, [saveSession, scheduleSessionRefresh]);

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  useEffect(() => {
    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        const now = Date.now();
        if (now - lastRefreshRef.current > MIN_APPSTATE_REFRESH_MS) {
          refreshSessionRef.current?.();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, []);

  const login = useCallback(
    async (userData: User, tokens: AuthTokens) => {
      await saveSession(userData, tokens);
    },
    [saveSession],
  );

  const logout = useCallback(async () => {
    try {
      await signOutEverywhere();
    } catch (error) {
      console.error('Amplify sign out failed; clearing local state anyway.', error);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      lastRefreshRef.current = 0;
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
      try {
        await clearStoredTokens();
      } catch (clearError) {
        console.error('Failed to clear secure auth tokens', clearError);
      }
    }
  }, []);

  const updateUser = useCallback(async (updatedUser: Partial<User>) => {
    if (!user) {
      return;
    }

    const newUser = {...user, ...updatedUser};
    setUser(newUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, [user]);

  const value = useMemo(
    () => ({
      isLoggedIn,
      user,
      isLoading,
      login,
      logout,
      updateUser,
      refreshSession,
    }),
    [isLoggedIn, isLoading, login, logout, refreshSession, updateUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
