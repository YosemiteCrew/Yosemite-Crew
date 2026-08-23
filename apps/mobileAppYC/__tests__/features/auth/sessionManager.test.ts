import {
  recoverAuthSession,
  persistSessionData,
  persistUserData,
  clearSessionData,
  getFreshStoredTokens,
  scheduleSessionRefresh,
  registerAppStateListener,
  resetAuthLifecycle,
  resolveExpiration,
  isTokenExpired,
  markAuthRefreshed,
  getUserStorageKey,
  REFRESH_BUFFER_MS,
} from '../../../src/features/auth/sessionManager';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import SuperTokens from 'supertokens-react-native';
import {Buffer} from 'node:buffer';
import {fetchProfileStatus} from '../../../src/features/account/services/profileService';
import {
  clearStoredTokens,
  loadSecureStorageTokensOnly,
  loadStoredTokens,
  storeTokens,
} from '../../../src/features/auth/services/tokenStorage';

// --- Mocks ---

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
  DeviceEventEmitter: {
    emit: jest.fn(),
    addListener: jest.fn(() => ({remove: jest.fn()})),
  },
}));

jest.mock('supertokens-react-native', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    signOut: jest.fn(),
    doesSessionExist: jest.fn(),
    getAccessToken: jest.fn(),
    getUserId: jest.fn(),
    attemptRefreshingSession: jest.fn(),
    addAxiosInterceptors: jest.fn(),
  },
}));

jest.mock('@/features/account/services/profileService', () => ({
  fetchProfileStatus: jest.fn(),
}));

jest.mock('@/features/auth/services/tokenStorage', () => ({
  clearStoredTokens: jest.fn(),
  loadSecureStorageTokensOnly: jest.fn(),
  loadStoredTokens: jest.fn(),
  storeTokens: jest.fn(),
}));

jest.mock('@/config/variables', () => ({
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile',
  PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
}));

jest.mock('@/features/auth/utils/parentProfileMapper', () => ({
  mergeUserWithParentProfile: jest.fn((user, parent) => ({
    ...user,
    ...(parent ? {merged: true} : {}),
  })),
}));

jest.mock('node:buffer', () => ({
  Buffer: {
    from: jest.fn(str => ({
      toString: () => {
        // Simple mock decoding for "jwt-like" strings
        if (str.includes('eyJleHAiOjEwMH0')) return '{"exp":100}'; // 100 seconds
        return '{}';
      },
    })),
  },
}));

const mockSuperTokens = SuperTokens as unknown as {
  signOut: jest.Mock;
  doesSessionExist: jest.Mock;
  getAccessToken: jest.Mock;
  getUserId: jest.Mock;
};

describe('sessionManager', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    parentId: 'parent-123',
  };

  const mockTokens = {
    idToken: 'header.eyJleHAiOjEwMH0.sig',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    provider: 'supertokens' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset module state to prevent pollution between tests
    resetAuthLifecycle();

    // Default: no SuperTokens session unless a test overrides
    mockSuperTokens.doesSessionExist.mockResolvedValue(false);
    mockSuperTokens.getAccessToken.mockResolvedValue(undefined);
    mockSuperTokens.getUserId.mockResolvedValue('st-user-123');
    mockSuperTokens.signOut.mockResolvedValue(undefined);

    // Default profile status mock to an incomplete profile unless a test overrides
    (fetchProfileStatus as jest.Mock).mockResolvedValue({
      profileToken: null,
      isComplete: false,
      parent: undefined,
    });

    // Reset token storage mocks — clearAllMocks keeps implementations set
    // via mockRejectedValue in earlier tests.
    (storeTokens as jest.Mock).mockResolvedValue(undefined);
    (clearStoredTokens as jest.Mock).mockResolvedValue(undefined);
    (loadStoredTokens as jest.Mock).mockResolvedValue(null);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.multiRemove as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ===========================================================================
  // 1. Helper Functions (Expiration, JWT)
  // ===========================================================================

  describe('resolveExpiration', () => {
    it('returns explicit expiresAt if provided', () => {
      const result = resolveExpiration({expiresAt: 999999});
      expect(result).toBe(999999);
    });

    it('decodes JWT expiration from idToken if expiresAt missing', () => {
      const mockJwt = 'header.eyJleHAiOjEwMH0.sig';
      const result = resolveExpiration({idToken: mockJwt});
      // 100 seconds * 1000 = 100000 ms
      expect(result).toBe(100000);
    });

    it('returns undefined if decoding fails or token format invalid', () => {
      expect(resolveExpiration({idToken: 'invalid-token'})).toBeUndefined();
      expect(resolveExpiration({idToken: ''})).toBeUndefined();
    });

    it('returns undefined and warns when the decoded payload is not valid JSON', () => {
      (Buffer.from as jest.Mock).mockImplementationOnce(() => ({
        toString: () => 'not-json{',
      }));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = resolveExpiration({idToken: 'header.somepayload.sig'});

      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to decode JWT expiration',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('isTokenExpired', () => {
    it('returns false if expiresAt is missing', () => {
      expect(isTokenExpired(null)).toBe(false);
      expect(isTokenExpired(undefined)).toBe(false);
    });

    it('returns true if time is past expiration minus buffer', () => {
      const now = 1000000;
      jest.setSystemTime(now);
      const expiresAt = now + REFRESH_BUFFER_MS - 1; // Just inside buffer
      expect(isTokenExpired(expiresAt)).toBe(true);
    });

    it('returns false if time is well before expiration', () => {
      const now = 1000000;
      jest.setSystemTime(now);
      const expiresAt = now + REFRESH_BUFFER_MS + 10000;
      expect(isTokenExpired(expiresAt)).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Persistence & Clearing
  // ===========================================================================

  describe('persistSessionData', () => {
    beforeEach(() => {
      // The legacy AsyncStorage copy is only dropped once the Keychain write
      // has been read back, so the happy path needs the readback to succeed.
      (loadSecureStorageTokensOnly as jest.Mock).mockResolvedValue(mockTokens);
    });

    it('saves user to AsyncStorage and tokens to SecureStore', async () => {
      await persistSessionData(mockUser, mockTokens);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        JSON.stringify(mockUser),
      );
      expect(storeTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          idToken: mockTokens.idToken,
          userId: 'user-123',
          email: 'test@example.com',
          provider: 'supertokens',
        }),
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens');
    });

    it('keeps the legacy copy when the Keychain write cannot be read back', async () => {
      // A Keychain that accepts the write and then returns nothing used to
      // leave the app with no readable token at all, because the fallback copy
      // had already been deleted.
      (loadSecureStorageTokensOnly as jest.Mock).mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await persistSessionData(mockUser, mockTokens);

      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('@auth_tokens');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auth_tokens',
        expect.stringContaining(mockTokens.idToken),
      );

      consoleSpy.mockRestore();
    });

    it('falls back to legacy storage if secure storage fails', async () => {
      (storeTokens as jest.Mock).mockRejectedValue(
        new Error('Secure store failed'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await persistSessionData(mockUser, mockTokens);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist auth tokens securely',
        expect.any(Error),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auth_tokens',
        expect.stringContaining(mockTokens.idToken),
      );

      consoleSpy.mockRestore();
    });

    it('handles error in fallback storage', async () => {
      (storeTokens as jest.Mock).mockRejectedValue(new Error('Secure fail'));
      (AsyncStorage.setItem as jest.Mock).mockImplementation(key => {
        if (key === '@auth_tokens') throw new Error('Legacy fail');
        return Promise.resolve();
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await persistSessionData(mockUser, mockTokens);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist auth tokens to legacy storage',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('persistUserData', () => {
    it('persists user data to async storage', async () => {
      await persistUserData(mockUser);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        JSON.stringify(mockUser),
      );
    });
  });

  describe('clearSessionData', () => {
    it('removes keys and clears tokens', async () => {
      await clearSessionData({clearPendingProfile: true});

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@user_data',
        '@auth_tokens',
        '@demo_api_mode',
        '@pending_profile',
      ]);
      expect(clearStoredTokens).toHaveBeenCalled();
    });

    it('handles secure store clear errors gracefully', async () => {
      (clearStoredTokens as jest.Mock).mockRejectedValue(
        new Error('Clear fail'),
      );
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await clearSessionData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear secure auth tokens',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getUserStorageKey', () => {
    it('returns the user key constant', () => {
      expect(getUserStorageKey()).toBe('@user_data');
    });
  });

  // ===========================================================================
  // 3. recoverAuthSession (SuperTokens Recovery Flows)
  // ===========================================================================

  describe('recoverAuthSession', () => {
    const mockActiveSession = (accessToken = 'st-access-token') => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(true);
      mockSuperTokens.getAccessToken.mockResolvedValue(accessToken);
    };

    it('recovers the session via SuperTokens when one exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });

      mockActiveSession();
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'new-profile-token',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const result = await recoverAuthSession();

      expect(mockSuperTokens.doesSessionExist).toHaveBeenCalled();
      expect(mockSuperTokens.getAccessToken).toHaveBeenCalled();
      expect(result).toEqual({
        kind: 'authenticated',
        user: expect.objectContaining({
          id: 'st-user-123',
          email: 'test@example.com',
          profileToken: 'new-profile-token',
        }),
        tokens: expect.objectContaining({
          provider: 'supertokens',
          accessToken: 'st-access-token',
          idToken: 'st-access-token',
        }),
        provider: 'supertokens',
      });
    });

    it('treats an unparsable pending profile payload as "none" and warns', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile') return Promise.resolve('not-json{');
        return Promise.resolve(null);
      });
      mockActiveSession();
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Auth] Failed to parse pending profile payload',
        expect.any(Error),
      );
      expect(result?.kind).toBe('authenticated');
      consoleSpy.mockRestore();
    });

    it('returns pendingProfile if the user matches the pending profile key', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@pending_profile')
          return Promise.resolve(JSON.stringify({userId: 'st-user-123'}));
        return Promise.resolve(null);
      });

      mockActiveSession();

      const result = await recoverAuthSession();
      expect(result).toEqual({kind: 'pendingProfile'});
    });

    it('handles profile resolution failure gracefully when a parent is known', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      mockActiveSession();
      (fetchProfileStatus as jest.Mock).mockRejectedValue(
        new Error('Profile API fail'),
      );

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect((result as any).user.profileToken).toBeUndefined();
      expect((result as any).user.parentId).toBe('parent-123');
    });

    it('falls back to the SDK user id when the stored user is missing', async () => {
      mockActiveSession();
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@pending_profile')
          return Promise.resolve(JSON.stringify({userId: 'st-user-123'}));
        return Promise.resolve(null);
      });

      const result = await recoverAuthSession();

      expect(mockSuperTokens.getUserId).toHaveBeenCalled();
      expect(result).toEqual({kind: 'pendingProfile'});
    });

    it('signs out orphaned sessions (no parent, no pending profile)', async () => {
      mockActiveSession();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: null,
        isComplete: false,
        parent: undefined,
      });

      const result = await recoverAuthSession();

      expect(mockSuperTokens.signOut).toHaveBeenCalled();
      expect(result).toEqual({kind: 'unauthenticated'});
    });

    it('falls back to the stored user id when the SDK id read throws', async () => {
      mockActiveSession();
      mockSuperTokens.getUserId.mockRejectedValueOnce(new Error('no id'));
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      // Fell back to the stored user's id, not the (failed) SDK read.
      expect((result as any).user.id).toBe(mockUser.id);
    });

    it('returns unauthenticated when there is no resolvable user id', async () => {
      mockActiveSession();
      mockSuperTokens.getUserId.mockResolvedValueOnce(
        undefined as unknown as string,
      );
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);

      const result = await recoverAuthSession();

      expect(result).toEqual({kind: 'unauthenticated'});
    });

    it('clears the pending flag and authenticates when the profile is now complete', async () => {
      mockActiveSession();
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile')
          return Promise.resolve(JSON.stringify({userId: 'st-user-123'}));
        return Promise.resolve(null);
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      // The pending marker was cleared rather than short-circuiting to
      // pendingProfile.
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_profile');
    });

    it('no-ops clearing the pending flag if the payload disappears between reads', async () => {
      mockActiveSession();
      let pendingProfileReadCount = 0;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile') {
          pendingProfileReadCount += 1;
          // First read (checkPendingProfile) finds a match; second read
          // (clearPendingProfileForUser) finds it already gone.
          return Promise.resolve(
            pendingProfileReadCount === 1
              ? JSON.stringify({userId: 'st-user-123'})
              : null,
          );
        }
        return Promise.resolve(null);
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
        '@pending_profile',
      );
    });

    it('no-ops clearing the pending flag if the payload now belongs to a different user', async () => {
      mockActiveSession();
      let pendingProfileReadCount = 0;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile') {
          pendingProfileReadCount += 1;
          return Promise.resolve(
            JSON.stringify({
              userId:
                pendingProfileReadCount === 1 ? 'st-user-123' : 'someone-else',
            }),
          );
        }
        return Promise.resolve(null);
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
        '@pending_profile',
      );
    });

    it('warns when clearing the pending profile payload fails to parse on the second read', async () => {
      mockActiveSession();
      let pendingProfileReadCount = 0;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile') {
          pendingProfileReadCount += 1;
          return Promise.resolve(
            pendingProfileReadCount === 1
              ? JSON.stringify({userId: 'st-user-123'})
              : 'not-json{',
          );
        }
        return Promise.resolve(null);
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
        profileToken: 'tok',
        isComplete: true,
        parent: {id: 'pid-1'},
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Auth] Failed to clear pending profile payload',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('continues recovery when orphan sign-out fails', async () => {
      mockActiveSession();
      mockSuperTokens.signOut.mockRejectedValue(new Error('signout failed'));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(result).toEqual({kind: 'unauthenticated'});
      consoleSpy.mockRestore();
    });

    it('falls back to stored tokens when no SuperTokens session exists', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);

      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });

      // Ensure tokens are NOT expired. Set expiresAt to future.
      const futureTime = Date.now() + 500000;
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: futureTime,
      });

      const result = await recoverAuthSession();

      expect(result).toEqual({
        kind: 'authenticated',
        user: expect.objectContaining({id: mockUser.id}),
        tokens: expect.anything(),
        provider: 'supertokens',
      });
    });

    it('falls back to stored tokens when the SDK returns no access token', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(true);
      mockSuperTokens.getAccessToken.mockResolvedValue(undefined);

      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() + 500000,
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect(fetchProfileStatus).not.toHaveBeenCalled();
    });

    it('migrates supertokens fallback tokens from AsyncStorage', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@auth_tokens')
          return Promise.resolve(JSON.stringify(mockTokens));
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue(null); // No secure tokens

      await recoverAuthSession();

      expect(storeTokens).toHaveBeenCalledWith(
        expect.objectContaining({accessToken: 'access-token'}),
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens');
    });

    it('ignores unparsable legacy tokens in AsyncStorage', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@auth_tokens') return Promise.resolve('not-json{');
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse stored auth tokens',
        expect.any(Error),
      );
      expect(result).toEqual({kind: 'unauthenticated'});
      consoleSpy.mockRestore();
    });

    it('ignores legacy amplify/firebase fallback tokens in AsyncStorage', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@auth_tokens')
          return Promise.resolve(
            JSON.stringify({...mockTokens, provider: 'amplify'}),
          );
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);

      const result = await recoverAuthSession();

      expect(storeTokens).not.toHaveBeenCalled();
      expect(result).toEqual({kind: 'unauthenticated'});
    });

    it('skips stored recovery when tokens are expired', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(result).toEqual({kind: 'unauthenticated'});
      consoleSpy.mockRestore();
    });

    it('returns pendingProfile for a stored-token session matching an incomplete pending profile', async () => {
      const incompleteUser = {
        id: 'user-456',
        email: 'incomplete@example.com',
      };
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(incompleteUser));
        if (key === '@pending_profile')
          return Promise.resolve(JSON.stringify({userId: 'user-456'}));
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() + 500000,
      });

      const result = await recoverAuthSession();

      expect(result).toEqual({kind: 'pendingProfile'});
    });

    it('clears the pending flag for a stored-token session whose profile is now complete', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@pending_profile')
          return Promise.resolve(JSON.stringify({userId: mockUser.id}));
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() + 500000,
      });

      const result = await recoverAuthSession();

      expect(result?.kind).toBe('authenticated');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_profile');
    });

    it('migrates legacy tokens even when secure storage persistence fails', async () => {
      mockSuperTokens.doesSessionExist.mockResolvedValue(false);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data')
          return Promise.resolve(JSON.stringify(mockUser));
        if (key === '@auth_tokens')
          return Promise.resolve(
            JSON.stringify({...mockTokens, expiresAt: Date.now() + 500000}),
          );
        return Promise.resolve(null);
      });
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);
      (storeTokens as jest.Mock).mockRejectedValueOnce(
        new Error('secure store unavailable'),
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await recoverAuthSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to migrate legacy auth tokens into secure storage',
        expect.any(Error),
      );
      expect(result?.kind).toBe('authenticated');
      consoleSpy.mockRestore();
    });

    it('returns unauthenticated if everything fails', async () => {
      mockSuperTokens.doesSessionExist.mockRejectedValue(
        new Error('SDK not initialized'),
      );
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await recoverAuthSession();

      expect(result).toEqual({kind: 'unauthenticated'});
      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 4. Token Refresh (getFreshStoredTokens)
  // ===========================================================================

  describe('getFreshStoredTokens', () => {
    it('returns stored tokens immediately if not expired', async () => {
      const futureTime = Date.now() + 500000; // Well into future
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: futureTime,
      });

      const result = await getFreshStoredTokens();
      expect(result?.accessToken).toBe('access-token');
      expect(result?.provider).toBe('supertokens');
      expect(mockSuperTokens.getAccessToken).not.toHaveBeenCalled();
    });

    it('returns null when nothing is stored', async () => {
      (loadStoredTokens as jest.Mock).mockResolvedValue(null);

      const result = await getFreshStoredTokens();
      expect(result).toBeNull();
    });

    it('refreshes via the SuperTokens SDK when tokens are expired', async () => {
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        userId: 'user-123',
        expiresAt: Date.now() - 1000, // Expired
      });
      mockSuperTokens.getAccessToken.mockResolvedValue('fresh-st-token');

      const result = await getFreshStoredTokens();

      expect(mockSuperTokens.getAccessToken).toHaveBeenCalled();
      expect(storeTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          idToken: 'fresh-st-token',
          accessToken: 'fresh-st-token',
          provider: 'supertokens',
        }),
      );
      expect(result?.accessToken).toBe('fresh-st-token');
      expect(result?.userId).toBe('user-123');
    });

    it('returns null when the SDK has no session to refresh', async () => {
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      });
      mockSuperTokens.getAccessToken.mockResolvedValue(undefined);

      const result = await getFreshStoredTokens();

      expect(result).toBeNull();
    });

    // Was: "returns the stale tokens if refresh fails". Handing a known-dead
    // credential back to the caller is the bug - it gets sent, the server
    // answers 401, and the screen renders axios's own "Request failed with
    // status code 401". Null routes the caller to its sign-in-again path.
    it('returns null if refresh fails, never the dead token', async () => {
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      });
      mockSuperTokens.getAccessToken.mockRejectedValue(
        new Error('Network fail'),
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await getFreshStoredTokens();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unable to refresh'),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    // The exact shape of the reported bug: the session is fully dead, so
    // getAccessToken() hands back the SAME expired token rather than throwing.
    // The old code stored that as "refreshed" and returned it.
    it('returns null when refresh hands back the same token', async () => {
      (loadStoredTokens as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: Date.now() - 1000,
      });
      mockSuperTokens.getAccessToken.mockResolvedValue('access-token');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await getFreshStoredTokens();

      expect(result).toBeNull();
      expect(storeTokens).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ===========================================================================
  // 5. Lifecycle (Timers & Listeners)
  // ===========================================================================

  describe('Lifecycle Functions', () => {
    it('scheduleSessionRefresh sets a timeout', () => {
      const spy = jest.spyOn(globalThis, 'setTimeout');
      const callback = jest.fn();
      const expiresAt = Date.now() + 500000;

      scheduleSessionRefresh(expiresAt, callback);

      expect(spy).toHaveBeenCalled();
      jest.runAllTimers();
      expect(callback).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('registerAppStateListener triggers refresh on active if time elapsed', () => {
      const callback = jest.fn();
      let listener: (state: string) => void = () => {};

      (AppState.addEventListener as jest.Mock).mockImplementation((evt, cb) => {
        listener = cb;
        return {remove: jest.fn()};
      });

      // Setup last timestamp way in the past
      markAuthRefreshed(Date.now() - 1000000);

      registerAppStateListener(callback);

      // Trigger active
      listener('active');

      expect(callback).toHaveBeenCalled();
    });

    it('resetAuthLifecycle clears timeouts and listeners', async () => {
      const spy = jest.spyOn(globalThis, 'clearTimeout');
      const removeSpy = jest.fn();
      (AppState.addEventListener as jest.Mock).mockReturnValue({
        remove: removeSpy,
      });

      registerAppStateListener(() => {});
      scheduleSessionRefresh(Date.now() + 1000, () => {});

      resetAuthLifecycle({clearPendingProfile: true});

      expect(spy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_profile');
      spy.mockRestore();
    });

    it('does not register a second AppState listener while one is already active', () => {
      (AppState.addEventListener as jest.Mock).mockReturnValue({
        remove: jest.fn(),
      });

      registerAppStateListener(() => {});
      registerAppStateListener(() => {});

      expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    });

    it('warns when clearing the pending profile flag fails during resetAuthLifecycle', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('remove failed'),
      );
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      resetAuthLifecycle({clearPendingProfile: true});
      // Allow the fire-and-forget promise chain to settle.
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear pending profile state',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
