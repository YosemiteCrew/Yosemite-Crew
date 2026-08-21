import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'yosemite-crew-session';
const KEYCHAIN_SERVICE_LEGACY = 'yosemite-crew-auth-tokens';
const KEYCHAIN_ACCOUNT = 'yosemite-crew';

/**
 * Mirror of the AsyncStorage key `persistSessionData` falls back to when the
 * Keychain write fails. Reading it here keeps every API call working on a
 * device where secure storage is unavailable, instead of only the session
 * recovery path that runs at launch.
 */
const ASYNC_STORAGE_FALLBACK_KEY = '@auth_tokens';

export type AuthProviderName = 'supertokens';

/**
 * Providers from before the SuperTokens cutover. Records stored with these
 * providers can no longer be recovered — the user simply signs in again.
 */
type LegacyAuthProviderName = 'amplify' | 'firebase';

export type StoredAuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  email?: string;
  provider?: AuthProviderName;
};

type KeychainOptions = Parameters<typeof Keychain.setGenericPassword>[2];

const keychainOptions: KeychainOptions = {
  service: KEYCHAIN_SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  securityLevel: Keychain.SECURITY_LEVEL.SECURE_SOFTWARE,
};

export const storeTokens = async (tokens: StoredAuthTokens): Promise<void> => {
  try {
    const tokensWithProvider: StoredAuthTokens = {
      ...tokens,
      provider: tokens.provider ?? 'supertokens',
    };
    const payload = JSON.stringify(tokensWithProvider);
    const didStore = await Keychain.setGenericPassword(
      KEYCHAIN_ACCOUNT,
      payload,
      keychainOptions,
    );

    if (!didStore) {
      throw new Error('Unable to persist auth tokens to secure storage');
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unexpected error while storing auth tokens securely',
    );
  }
};

const parsedTokensOrNull = (password: string): StoredAuthTokens | null => {
  try {
    const parsed = JSON.parse(password) as StoredAuthTokens & {
      provider?: AuthProviderName | LegacyAuthProviderName;
    };
    if (parsed.provider !== 'supertokens') {
      // Legacy Amplify/Firebase record (or pre-provider record). Those
      // sessions cannot be recovered post-cutover — treat as signed out.
      return null;
    }
    return {...parsed, provider: 'supertokens'};
  } catch (parseError) {
    console.warn('Failed to parse tokens from secure storage', parseError);
    return null;
  }
};

/**
 * Reads only the Keychain, with no AsyncStorage fallback. Callers verifying
 * that a write actually landed need this, because the fallback would otherwise
 * report success for a record secure storage never stored.
 */
export const loadSecureStorageTokensOnly =
  async (): Promise<StoredAuthTokens | null> => {
    try {
      const credentials = await Keychain.getGenericPassword(keychainOptions);
      return credentials ? parsedTokensOrNull(credentials.password) : null;
    } catch (error) {
      console.warn('Unable to read tokens back from secure storage', error);
      return null;
    }
  };

const loadAsyncStorageFallbackTokens =
  async (): Promise<StoredAuthTokens | null> => {
    try {
      const raw = await AsyncStorage.getItem(ASYNC_STORAGE_FALLBACK_KEY);
      return raw ? parsedTokensOrNull(raw) : null;
    } catch (error) {
      console.warn('Unable to read fallback auth tokens', error);
      return null;
    }
  };

export const loadStoredTokens = async (): Promise<StoredAuthTokens | null> => {
  try {
    const credentials = await Keychain.getGenericPassword(keychainOptions);
    if (credentials) {
      const tokens = parsedTokensOrNull(credentials.password);
      if (tokens) {
        return tokens;
      }
      // Unreadable or pre-cutover record. Drop it, but only fall back to a
      // signed-out state once the AsyncStorage fallback is ruled out too.
      await clearStoredTokens().catch(() => undefined);
      return loadAsyncStorageFallbackTokens();
    }

    // Records stored under the previous service name predate SuperTokens —
    // clear them so stale Amplify/Firebase sessions don't linger.
    const legacy = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE_LEGACY,
    });
    if (legacy) {
      await Keychain.resetGenericPassword({service: KEYCHAIN_SERVICE_LEGACY});
    }

    return loadAsyncStorageFallbackTokens();
  } catch (error) {
    console.error('Unable to read tokens from secure storage', error);
    return loadAsyncStorageFallbackTokens();
  }
};

export const clearStoredTokens = async (): Promise<void> => {
  try {
    await Keychain.resetGenericPassword(keychainOptions);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unexpected error while clearing secure auth tokens',
    );
  }
};
