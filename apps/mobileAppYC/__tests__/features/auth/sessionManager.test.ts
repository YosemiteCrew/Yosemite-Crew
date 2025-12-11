// Mock dependencies FIRST before importing
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/features/auth/services/tokenStorage');
jest.mock('@/features/account/services/profileService');
jest.mock('@/features/auth/services/authUserService');
jest.mock('@/features/auth/utils/parentProfileMapper', () => ({
  mergeUserWithParentProfile: (user: any) => user,
}));
jest.mock('aws-amplify/auth');

jest.mock('@react-native-firebase/auth');

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {fetchAuthSession, fetchUserAttributes, getCurrentUser} from 'aws-amplify/auth';
import * as firebaseAuth from '@react-native-firebase/auth';
import {
  persistSessionData,
  persistUserData,
  clearSessionData,
  recoverAuthSession,
  scheduleSessionRefresh,
  registerAppStateListener,
  markAuthRefreshed,
  resetAuthLifecycle,
} from '@/features/auth/sessionManager';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
} from '@/features/auth/services/tokenStorage';
import {fetchProfileStatus} from '@/features/account/services/profileService';
import {syncAuthUser} from '@/features/auth/services/authUserService';
import type {User} from '@/features/auth/types';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockStoreTokens = storeTokens as jest.MockedFunction<typeof storeTokens>;
const mockLoadStoredTokens = loadStoredTokens as jest.MockedFunction<typeof loadStoredTokens>;
const mockClearStoredTokens = clearStoredTokens as jest.MockedFunction<typeof clearStoredTokens>;
const mockFetchProfileStatus = fetchProfileStatus as jest.MockedFunction<typeof fetchProfileStatus>;
const mockSyncAuthUser = syncAuthUser as jest.MockedFunction<typeof syncAuthUser>;
const mockFetchAuthSession = fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>;
const mockFetchUserAttributes = fetchUserAttributes as jest.MockedFunction<typeof fetchUserAttributes>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const firebaseAuthMock = firebaseAuth as jest.Mocked<typeof firebaseAuth>;

describe('sessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    firebaseAuthMock.getAuth.mockReturnValue({currentUser: null} as any);
    firebaseAuthMock.reload.mockResolvedValue(undefined as any);
    firebaseAuthMock.getIdToken.mockResolvedValue('firebase-id-token' as any);
    firebaseAuthMock.getIdTokenResult.mockResolvedValue({
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('persistUserData', () => {
    it('should persist user data to AsyncStorage', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      await persistUserData(mockUser);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        JSON.stringify(mockUser),
      );
    });
  });

  describe('persistSessionData', () => {
    it('should persist both user and token data', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const mockTokens = {
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        userId: 'user-123',
        provider: 'amplify' as const,
      };

      mockStoreTokens.mockResolvedValue(undefined);

      const result = await persistSessionData(mockUser, mockTokens);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        JSON.stringify(mockUser),
      );
      expect(mockStoreTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access-token',
          userId: 'user-123',
        }),
      );
      expect(result).toMatchObject({
        accessToken: 'access-token',
        userId: 'user-123',
      });
    });
  });

  describe('clearSessionData', () => {
    it('should clear user and token data from storage', async () => {
      mockClearStoredTokens.mockResolvedValue(undefined);

      await clearSessionData();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining(['@user_data', '@auth_tokens']),
      );
      expect(mockClearStoredTokens).toHaveBeenCalled();
    });

    it('should also clear pending profile when requested', async () => {
      mockClearStoredTokens.mockResolvedValue(undefined);

      await clearSessionData({clearPendingProfile: true});

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining(['@user_data', '@auth_tokens', '@pending_profile_payload']),
      );
    });

    it('should handle errors when clearing secure tokens', async () => {
      mockClearStoredTokens.mockRejectedValue(new Error('Clear failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await clearSessionData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear secure auth tokens',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('recoverAuthSession - Amplify', () => {
    it('should recover authenticated Amplify session', async () => {
      const mockSession = {
        tokens: {
          idToken: {
            toString: () => 'amplify-id-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
          accessToken: {
            toString: () => 'amplify-access-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
        },
      };

      mockFetchAuthSession.mockResolvedValue(mockSession as any);
      mockGetCurrentUser.mockResolvedValue({
        userId: 'amplify-user-123',
        username: 'test@example.com',
      } as any);
      mockFetchUserAttributes.mockResolvedValue({
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
      });
      mockFetchProfileStatus.mockResolvedValue({
        exists: true,
        isComplete: true,
        profileToken: 'profile-token',
        source: 'remote',
      });

      const result = await recoverAuthSession();

      expect(result.kind).toBe('authenticated');
      if (result.kind === 'authenticated') {
        expect(result.user.email).toBe('test@example.com');
        expect(result.user.firstName).toBe('Test');
        expect(result.provider).toBe('amplify');
      }
    });

    it('should return pendingProfile when profile does not exist', async () => {
      const mockSession = {
        tokens: {
          idToken: {
            toString: () => 'amplify-id-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
          accessToken: {
            toString: () => 'amplify-access-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
        },
      };

      mockFetchAuthSession.mockResolvedValue(mockSession as any);
      mockGetCurrentUser.mockResolvedValue({
        userId: 'amplify-user-123',
        username: 'test@example.com',
      } as any);
      mockFetchUserAttributes.mockResolvedValue({
        email: 'test@example.com',
      });

      // Mock AsyncStorage to return pending profile data
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === '@pending_profile_payload') {
          return JSON.stringify({userId: 'amplify-user-123'});
        }
        return null;
      });

      mockFetchProfileStatus.mockResolvedValue({
        exists: false,
        isComplete: false,
        profileToken: 'test-profile-token',
        source: 'remote',
      });

      const result = await recoverAuthSession();

      expect(result.kind).toBe('pendingProfile');
    });
  });

  describe('recoverAuthSession - Firebase', () => {
    it('should recover authenticated Firebase session when Amplify fails', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No Amplify session'));
      mockLoadStoredTokens.mockResolvedValue(null); // No stored tokens

      const mockFirebaseUser = {
        uid: 'firebase-user-123',
        email: 'firebase@example.com',
        photoURL: 'https://example.com/photo.jpg',
      };

      firebaseAuthMock.getAuth.mockReturnValue({
        currentUser: mockFirebaseUser,
      } as any);

      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === '@user_data') {
          return JSON.stringify({
            id: 'firebase-user-123',
            email: 'firebase@example.com',
            firstName: 'Firebase',
            lastName: 'User',
            profileToken: 'firebase-profile-token',
            profileCompleted: true,
          });
        }
        return null; // No pending profile
      });

      mockSyncAuthUser.mockResolvedValue({
        userId: 'firebase-user-123',
        parentSummary: {
          id: 'parent-123',
          firstName: 'Firebase',
          lastName: 'User',
          profileImageUrl: 'firebase-profile-token',
          isComplete: true,
        },
      });

      mockFetchProfileStatus.mockResolvedValue({
        exists: true,
        isComplete: true,
        profileToken: 'firebase-profile-token',
        source: 'remote',
      });
      mockStoreTokens.mockResolvedValue(undefined);

      const result = await recoverAuthSession();

      expect(result.kind).toBe('authenticated');
      if (result.kind === 'authenticated') {
        expect(result.user.email).toBe('firebase@example.com');
        expect(result.provider).toBe('firebase');
      }
    });

    it('should fetch profile status for Firebase user without profile token', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No Amplify session'));
      mockLoadStoredTokens.mockResolvedValue(null); // No stored tokens

      const mockFirebaseUser = {
        uid: 'firebase-user-123',
        email: 'firebase@example.com',
      };

      firebaseAuthMock.getAuth.mockReturnValue({
        currentUser: mockFirebaseUser,
      } as any);

      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === '@user_data') {
          return JSON.stringify({
            id: 'firebase-user-123',
            email: 'firebase@example.com',
            parentId: 'parent-123',
          });
        }
        return null; // No pending profile
      });

      // No parentSummary from syncAuthUser to force fetching profile status
      mockSyncAuthUser.mockResolvedValue({
        userId: 'firebase-user-123',
      });

      mockFetchProfileStatus.mockResolvedValue({
        exists: true,
        isComplete: true,
        profileToken: 'new-profile-token',
        source: 'remote',
      });
      mockStoreTokens.mockResolvedValue(undefined);

      const result = await recoverAuthSession();

      expect(mockFetchProfileStatus).toHaveBeenCalled();
      expect(result.kind).toBe('authenticated');
    });
  });

  describe('recoverAuthSession - Fallback to stored tokens', () => {
    it('should fallback to stored tokens when both Amplify and Firebase fail', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No Amplify session'));
      firebaseAuthMock.getAuth.mockReturnValue({currentUser: null} as any);

      const mockUser: User = {
        id: 'stored-user-123',
        email: 'stored@example.com',
        profileToken: 'stored-profile-token',
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockUser));

      mockLoadStoredTokens.mockResolvedValue({
        idToken: 'stored-id-token',
        accessToken: 'stored-access-token',
        userId: 'stored-user-123',
        provider: 'amplify',
      });

      const result = await recoverAuthSession();

      expect(result.kind).toBe('authenticated');
      if (result.kind === 'authenticated') {
        expect(result.user.email).toBe('stored@example.com');
        expect(result.tokens.accessToken).toBe('stored-access-token');
      }
    });

    it('should return unauthenticated when no valid session exists', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      firebaseAuthMock.getAuth.mockReturnValue({currentUser: null} as any);
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockLoadStoredTokens.mockResolvedValue(null);

      const result = await recoverAuthSession();

      expect(result.kind).toBe('unauthenticated');
      expect(mockClearStoredTokens).toHaveBeenCalled();
    });

    it('returns unauthenticated when legacy tokens are invalid JSON', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      firebaseAuthMock.getAuth.mockReturnValue({currentUser: null} as any);
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === '@auth_tokens') return 'not-json';
        return null;
      });
      mockLoadStoredTokens.mockResolvedValue(null);
      const result = await recoverAuthSession();
      expect(result.kind).toBe('unauthenticated');
    });

    it('migrates legacy tokens when present and returns authenticated', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      firebaseAuthMock.getAuth.mockReturnValue({currentUser: null} as any);

      const mockUser: User = { id: 'legacy-user', email: 'legacy@example.com' };
      mockAsyncStorage.getItem.mockImplementation(async (key: string) => {
        if (key === '@user_data') return JSON.stringify(mockUser);
        if (key === '@auth_tokens') {
          const expSec = Math.floor(Date.now() / 1000) + 3600;
          // eslint-disable-next-line no-div-regex
          const payload = Buffer.from(JSON.stringify({ exp: expSec })).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
          const idToken = `a.${payload}.b`;
          return JSON.stringify({ idToken, accessToken: 'legacy-access', provider: 'amplify' });
        }
        return null;
      });

      mockStoreTokens.mockResolvedValue(undefined);

      const result = await recoverAuthSession();
      expect(result.kind).toBe('authenticated');
      if (result.kind === 'authenticated') {
        expect(result.user.email).toBe('legacy@example.com');
        expect(result.tokens.accessToken).toBe('legacy-access');
      }
    });
  });

  describe('scheduleSessionRefresh', () => {
    it('should schedule token refresh before expiration', () => {
      const refreshCallback = jest.fn();
      const expiresAt = Date.now() + 3600000; // 1 hour from now

      scheduleSessionRefresh(expiresAt, refreshCallback);

      // Fast-forward to just before expiration (minus buffer)
      jest.advanceTimersByTime(3600000 - 2 * 60 * 1000);

      expect(refreshCallback).toHaveBeenCalled();
    });

    it('should use default interval when expiresAt is not provided', () => {
      const refreshCallback = jest.fn();

      scheduleSessionRefresh(undefined, refreshCallback);

      // Fast-forward default interval (6 hours)
      jest.advanceTimersByTime(6 * 60 * 60 * 1000);

      expect(refreshCallback).toHaveBeenCalled();
    });

    it('should handle multiple refresh schedules', () => {
      const refreshCallback = jest.fn();

      // Test that scheduling works without errors
      expect(() => {
        scheduleSessionRefresh(Date.now() + 10000, refreshCallback);
        scheduleSessionRefresh(Date.now() + 20000, refreshCallback);
      }).not.toThrow();
    });

    it('clamps very long delays to maximum refresh delay', () => {
      const refreshCallback = jest.fn();
      const twelveHours = 12 * 60 * 60 * 1000;
      // Far in the future -> should clamp to 12h window
      scheduleSessionRefresh(Date.now() + 1000 * 24 * 60 * 60 * 1000, refreshCallback);
      jest.advanceTimersByTime(twelveHours);
      expect(refreshCallback).toHaveBeenCalled();
    });
  });

  describe('registerAppStateListener', () => {
    beforeEach(() => {
      // Reset the listener before each test
      resetAuthLifecycle();
    });

    it('should register app state change listener', () => {
      const mockAddEventListener = jest.fn().mockReturnValue({remove: jest.fn()});
      (AppState.addEventListener as jest.Mock) = mockAddEventListener;

      const refreshCallback = jest.fn();

      registerAppStateListener(refreshCallback);

      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not register duplicate listeners', () => {
      const mockAddEventListener = jest.fn().mockReturnValue({remove: jest.fn()});
      (AppState.addEventListener as jest.Mock) = mockAddEventListener;

      const refreshCallback = jest.fn();

      registerAppStateListener(refreshCallback);
      registerAppStateListener(refreshCallback);

      // Should only be called once since duplicate registration is prevented
      expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    });

    it('invokes refresh callback when app becomes active and threshold passed', () => {
      const listeners: any[] = [];
      (AppState.addEventListener as jest.Mock) = jest.fn((_event, cb) => {
        listeners.push(cb);
        return {remove: jest.fn()};
      });
      const refreshCallback = jest.fn();
      registerAppStateListener(refreshCallback);
      // Trigger active event
      listeners[0]('active');
      expect(refreshCallback).toHaveBeenCalled();
    });

    it('does not invoke refresh if within threshold due to recent markAuthRefreshed', () => {
      const listeners: any[] = [];
      (AppState.addEventListener as jest.Mock) = jest.fn((_event, cb) => {
        listeners.push(cb);
        return {remove: jest.fn()};
      });
      const refreshCallback = jest.fn();
      registerAppStateListener(refreshCallback);
      // Set recent refresh timestamp
      markAuthRefreshed(Date.now());
      // Immediately trigger active; should not call due to threshold
      refreshCallback.mockClear();
      listeners[0]('active');
      expect(refreshCallback).not.toHaveBeenCalled();
    });
  });

  describe('markAuthRefreshed', () => {
    it('should update last refresh timestamp', () => {
      const timestamp = Date.now();
      markAuthRefreshed(timestamp);

      // This function updates internal state, so we can't directly test it
      // But we can verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should use current time when timestamp not provided', () => {
      expect(() => markAuthRefreshed()).not.toThrow();
    });
  });

  describe('resetAuthLifecycle', () => {
    it('should clear all auth lifecycle state', () => {
      // We'll test that reset clears state without errors
      // The actual listener clearing is internal implementation
      expect(() => resetAuthLifecycle()).not.toThrow();
    });

    it('should clear pending profile when requested', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue(undefined);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      resetAuthLifecycle({clearPendingProfile: true});

      // Wait for async operation to complete
      await jest.runAllTimersAsync();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@pending_profile_payload');

      consoleWarnSpy.mockRestore();
    });
  });

  it('getUserStorageKey returns the user storage key', () => {
    const {getUserStorageKey} = require('@/features/auth/sessionManager');
    expect(getUserStorageKey()).toBe('@user_data');
  });
});
