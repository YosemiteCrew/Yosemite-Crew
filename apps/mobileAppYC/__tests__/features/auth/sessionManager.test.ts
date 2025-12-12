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
import {
  getAuth,
  getIdToken,
  getIdTokenResult,
  reload,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import {
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
} from 'aws-amplify/auth';
import {syncAuthUser} from '../../../src/features/auth/services/authUserService';
import {fetchProfileStatus} from '../../../src/features/account/services/profileService';
import {
  clearStoredTokens,
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
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  reload: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn(),
  fetchUserAttributes: jest.fn(),
  getCurrentUser: jest.fn(),
}));

jest.mock('@/features/auth/services/authUserService', () => ({
  syncAuthUser: jest.fn(),
}));

jest.mock('@/features/account/services/profileService', () => ({
  fetchProfileStatus: jest.fn(),
}));

jest.mock('@/features/auth/services/tokenStorage', () => ({
  clearStoredTokens: jest.fn(),
  loadStoredTokens: jest.fn(),
  storeTokens: jest.fn(),
}));

jest.mock('@/config/variables', () => ({
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile',
}));

jest.mock('@/features/auth/utils/parentProfileMapper', () => ({
  mergeUserWithParentProfile: jest.fn((user, parent) => ({
    ...user,
    ...(parent ? {merged: true} : {}),
  })),
}));

jest.mock('node:buffer', () => ({
  Buffer: {
    from: jest.fn((str) => ({
      toString: () => {
        // Simple mock decoding for "jwt-like" strings
        if (str.includes('eyJleHAiOjEwMH0')) return '{"exp":100}'; // 100 seconds
        return '{}';
      },
    })),
  },
}));

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
    provider: 'amplify' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset module state to prevent pollution between tests
    resetAuthLifecycle();

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
      const token = 'header.eyJleHAiOjEwMH0.sig';
      const result = resolveExpiration({idToken: token});
      // 100 seconds * 1000 = 100000 ms
      expect(result).toBe(100000);
    });

    it('returns undefined if decoding fails or token format invalid', () => {
      expect(resolveExpiration({idToken: 'invalid-token'})).toBeUndefined();
      expect(resolveExpiration({idToken: ''})).toBeUndefined();
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
          provider: 'amplify',
        }),
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens');
    });

    it('falls back to legacy storage if secure storage fails', async () => {
      (storeTokens as jest.Mock).mockRejectedValue(new Error('Secure store failed'));
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
       (AsyncStorage.setItem as jest.Mock).mockImplementation((key) => {
           if(key === '@auth_tokens') throw new Error('Legacy fail');
           return Promise.resolve();
       });
       const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

       await persistSessionData(mockUser, mockTokens);

       expect(consoleSpy).toHaveBeenCalledWith('Failed to persist auth tokens to legacy storage', expect.any(Error));
       consoleSpy.mockRestore();
    });
  });

  describe('persistUserData', () => {
      it('persists user data to async storage', async () => {
          await persistUserData(mockUser);
          expect(AsyncStorage.setItem).toHaveBeenCalledWith('@user_data', JSON.stringify(mockUser));
      });
  });

  describe('clearSessionData', () => {
    it('removes keys and clears tokens', async () => {
      await clearSessionData({clearPendingProfile: true});

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@user_data',
        '@auth_tokens',
        '@pending_profile',
      ]);
      expect(clearStoredTokens).toHaveBeenCalled();
    });

    it('handles secure store clear errors gracefully', async () => {
      (clearStoredTokens as jest.Mock).mockRejectedValue(new Error('Clear fail'));
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
  // 3. recoverAuthSession (Complex Recovery Flows)
  // ===========================================================================

  describe('recoverAuthSession', () => {
    // --- Amplify Recovery ---
    it('recovers session via Amplify if session exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@user_data') return Promise.resolve(JSON.stringify(mockUser));
        return Promise.resolve(null);
      });

      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: {toString: () => 'amplify-id', payload: {exp: 9999999999}},
          accessToken: {toString: () => 'amplify-access'},
        },
      });
      (getCurrentUser as jest.Mock).mockResolvedValue({
        userId: 'amplify-user-123',
        username: 'amplify-user',
      });
      (fetchUserAttributes as jest.Mock).mockResolvedValue({
        email: 'amplify@test.com',
        given_name: 'Amplify',
      });
      (fetchProfileStatus as jest.Mock).mockResolvedValue({
          profileToken: 'new-profile-token',
          isComplete: true,
          parent: {id: 'pid-1'}
      });

      const result = await recoverAuthSession();

      expect(fetchAuthSession).toHaveBeenCalledWith({forceRefresh: true});
      expect(result).toEqual({
        kind: 'authenticated',
        user: expect.objectContaining({
            email: 'amplify@test.com',
            profileToken: 'new-profile-token'
        }),
        tokens: expect.objectContaining({provider: 'amplify'}),
        provider: 'amplify',
      });
    });

    it('returns pendingProfile if Amplify user matches pending profile key', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@pending_profile') return Promise.resolve(JSON.stringify({userId: 'amplify-user-123'}));
        return Promise.resolve(null);
      });

      (fetchAuthSession as jest.Mock).mockResolvedValue({tokens: {idToken: 't', accessToken: 't'}});
      (getCurrentUser as jest.Mock).mockResolvedValue({userId: 'amplify-user-123'});

      const result = await recoverAuthSession();
      expect(result).toEqual({kind: 'pendingProfile'});
    });

    it('handles resolveProfileTokenForUser failure gracefully in Amplify flow', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
        (fetchAuthSession as jest.Mock).mockResolvedValue({
            tokens: { idToken: 'id', accessToken: 'acc' }
        });
        (getCurrentUser as jest.Mock).mockResolvedValue({userId: 'u1'});
        (fetchUserAttributes as jest.Mock).mockResolvedValue({});
        (fetchProfileStatus as jest.Mock).mockRejectedValue(new Error('Profile API fail'));

        const result = await recoverAuthSession();

        expect(result?.kind).toBe('authenticated');
        expect((result as any).user.profileToken).toBeUndefined();
    });

    // --- Firebase Recovery ---
    it('falls back to Firebase if Amplify fails', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValue(new Error('No Amplify session'));

      const mockFirebaseUser = {
        uid: 'firebase-uid',
        email: 'fb@test.com',
      };
      (getAuth as jest.Mock).mockReturnValue({currentUser: mockFirebaseUser});
      (getIdToken as jest.Mock).mockResolvedValue('fb-id-token');
      (getIdTokenResult as jest.Mock).mockResolvedValue({expirationTime: new Date().toISOString()});
      (syncAuthUser as jest.Mock).mockResolvedValue({parentSummary: {id: 'p1', isComplete: true}});

      const result = await recoverAuthSession();

      expect(getAuth).toHaveBeenCalled();
      expect(reload).toHaveBeenCalledWith(mockFirebaseUser);
      expect(result).toEqual(expect.objectContaining({
          kind: 'authenticated',
          provider: 'firebase'
      }));
    });

    it('signs out orphaned Firebase user (no parent, no pending profile)', async () => {
        (fetchAuthSession as jest.Mock).mockRejectedValue(new Error());
        (getAuth as jest.Mock).mockReturnValue({currentUser: {uid: 'orphan'}});
        (reload as jest.Mock).mockResolvedValue(undefined);
        (getIdToken as jest.Mock).mockResolvedValue('token');
        (syncAuthUser as jest.Mock).mockResolvedValue({});
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        const result = await recoverAuthSession();

        expect(firebaseSignOut).toHaveBeenCalled();
        // Since Firebase recovery returns null, it falls through to stored (which is empty),
        // then clears session and returns unauthenticated.
        expect(result).toEqual({kind: 'unauthenticated'});
    });

    // --- Stored Tokens Recovery ---
    it('falls back to stored tokens if both providers fail', async () => {
        (fetchAuthSession as jest.Mock).mockRejectedValue(new Error());
        (getAuth as jest.Mock).mockReturnValue({currentUser: null});

        (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
            if (key === '@user_data') return Promise.resolve(JSON.stringify(mockUser));
            return Promise.resolve(null);
        });

        // Ensure tokens are NOT expired. Set expiresAt to future.
        const futureTime = Date.now() + 500000;
        (loadStoredTokens as jest.Mock).mockResolvedValue({
            ...mockTokens,
            expiresAt: futureTime
        });

        const result = await recoverAuthSession();

        expect(result).toEqual({
            kind: 'authenticated',
            user: expect.objectContaining({id: mockUser.id}),
            tokens: expect.anything(),
            provider: 'amplify'
        });
    });

    it('migrates legacy tokens if secure tokens missing', async () => {
        (fetchAuthSession as jest.Mock).mockRejectedValue(new Error());
        (getAuth as jest.Mock).mockReturnValue({currentUser: null});
        (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
            if (key === '@user_data') return Promise.resolve(JSON.stringify(mockUser));
            if (key === '@auth_tokens') return Promise.resolve(JSON.stringify(mockTokens));
            return Promise.resolve(null);
        });
        (loadStoredTokens as jest.Mock).mockResolvedValue(null); // No secure tokens

        await recoverAuthSession();

        expect(storeTokens).toHaveBeenCalledWith(expect.objectContaining({accessToken: 'access-token'}));
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens');
    });

    it('returns unauthenticated if everything fails', async () => {
        (fetchAuthSession as jest.Mock).mockRejectedValue(new Error());
        (getAuth as jest.Mock).mockReturnValue({currentUser: null});
        (loadStoredTokens as jest.Mock).mockResolvedValue(null);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        const result = await recoverAuthSession();

        expect(result).toEqual({kind: 'unauthenticated'});
        expect(AsyncStorage.multiRemove).toHaveBeenCalled();
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
           expiresAt: futureTime
       });

       const result = await getFreshStoredTokens();
       expect(result?.accessToken).toBe('access-token');
       expect(fetchAuthSession).not.toHaveBeenCalled();
    });

    it('refreshes Firebase tokens if expired', async () => {
        // Mock expired stored tokens
        (loadStoredTokens as jest.Mock).mockResolvedValue({
            ...mockTokens,
            provider: 'firebase',
            expiresAt: Date.now() - 1000 // Expired
        });

        const mockFbUser = {uid: 'fb-1'};
        (getAuth as jest.Mock).mockReturnValue({currentUser: mockFbUser});
        (getIdToken as jest.Mock).mockResolvedValue('new-fb-token');
        (getIdTokenResult as jest.Mock).mockResolvedValue({expirationTime: new Date(Date.now() + 100000).toISOString()});
    });

    it('refreshes Amplify tokens if expired', async () => {
        // Mock expired stored tokens
        (loadStoredTokens as jest.Mock).mockResolvedValue({
            ...mockTokens,
            provider: 'amplify',
            expiresAt: Date.now() - 1000 // Expired
        });
        (fetchAuthSession as jest.Mock).mockResolvedValue({
            tokens: {
                idToken: {toString: () => 'new-amp-id', payload: {exp: Math.floor(Date.now()/1000) + 1000}},
                accessToken: {toString: () => 'new-amp-access', payload: {exp: Math.floor(Date.now()/1000) + 1000}}
            }
        });
        (getCurrentUser as jest.Mock).mockResolvedValue({userId: 'amp-1'});
    });

    it('returns null if refresh fails', async () => {
        (loadStoredTokens as jest.Mock).mockResolvedValue({
            ...mockTokens,
            expiresAt: Date.now() - 1000
        });
        (fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Network fail'));

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const result = await getFreshStoredTokens();

        // Returns the old tokens (normalized) if refresh fails
        expect(result?.accessToken).toBe('access-token');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to refresh'), expect.any(Error));
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
        (AppState.addEventListener as jest.Mock).mockReturnValue({remove: removeSpy});

        registerAppStateListener(() => {});
        scheduleSessionRefresh(Date.now() + 1000, () => {});

        resetAuthLifecycle({clearPendingProfile: true});

        expect(spy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@pending_profile');
        spy.mockRestore();
    });
  });
});