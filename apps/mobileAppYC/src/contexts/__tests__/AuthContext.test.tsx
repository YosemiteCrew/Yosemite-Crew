import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import {fetchAuthSession, fetchUserAttributes, getCurrentUser} from 'aws-amplify/auth';
import {AuthProvider, useAuth, User, AuthTokens} from '../AuthContext';
import {signOutEverywhere} from '@/services/auth/passwordlessAuth';
import {fetchProfileStatus} from '@/services/profile/profileService';
import {
  clearStoredTokens,
  loadStoredTokens,
  storeTokens,
} from '@/services/auth/tokenStorage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-firebase/auth');
jest.mock('aws-amplify/auth');
jest.mock('@/services/auth/passwordlessAuth');
jest.mock('@/services/profile/profileService');
jest.mock('@/services/auth/tokenStorage');
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    currentState: 'active',
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockGetAuth = getAuth as jest.MockedFunction<typeof getAuth>;
const mockFetchAuthSession = fetchAuthSession as jest.MockedFunction<typeof fetchAuthSession>;
const mockFetchUserAttributes = fetchUserAttributes as jest.MockedFunction<typeof fetchUserAttributes>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockSignOutEverywhere = signOutEverywhere as jest.MockedFunction<typeof signOutEverywhere>;
const mockFetchProfileStatus = fetchProfileStatus as jest.MockedFunction<typeof fetchProfileStatus>;
const mockClearStoredTokens = clearStoredTokens as jest.MockedFunction<typeof clearStoredTokens>;
const mockLoadStoredTokens = loadStoredTokens as jest.MockedFunction<typeof loadStoredTokens>;
const mockStoreTokens = storeTokens as jest.MockedFunction<typeof storeTokens>;

const wrapper = ({children}: {children: React.ReactNode}) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    profileToken: 'mock-profile-token',
  };

  const mockTokens: AuthTokens = {
    idToken: 'mock-id-token',
    accessToken: 'mock-access-token',
    userId: 'test-user-id',
    provider: 'amplify',
    expiresAt: Date.now() + 3600000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
    mockLoadStoredTokens.mockResolvedValue(null);
    mockStoreTokens.mockResolvedValue(undefined);
    mockClearStoredTokens.mockResolvedValue(undefined);
    mockFetchProfileStatus.mockResolvedValue({
      exists: true,
      profileToken: 'mock-profile-token',
      source: 'remote',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleErrorSpy.mockRestore();
    });

    it('should return context when used within AuthProvider', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('isLoggedIn');
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('updateUser');
      expect(result.current).toHaveProperty('refreshSession');
    });
  });

  describe('Initial state', () => {
    it('should initialize with loading state', () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should finish loading when no session exists', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('login', () => {
    it('should successfully login user', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.provider).toBe('amplify');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        JSON.stringify(mockUser)
      );
      expect(mockStoreTokens).toHaveBeenCalled();
    });

    it('should handle login with Firebase provider', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const firebaseTokens: AuthTokens = {
        ...mockTokens,
        provider: 'firebase',
      };

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, firebaseTokens);
      });

      expect(result.current.provider).toBe('firebase');
    });
  });

  describe('logout', () => {
    it('should successfully logout Amplify user', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockSignOutEverywhere).toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.provider).toBeNull();
      expect(mockClearStoredTokens).toHaveBeenCalled();
    });

    it('should successfully logout Firebase user', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      const mockFirebaseSignOut = jest.fn();
      mockGetAuth.mockReturnValue({
        currentUser: null,
        signOut: mockFirebaseSignOut,
      } as any);

      const firebaseTokens: AuthTokens = {
        ...mockTokens,
        provider: 'firebase',
      };

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, firebaseTokens);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockFirebaseSignOut).toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(false);
    });

    it('should handle logout errors gracefully', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);
      mockSignOutEverywhere.mockRejectedValue(new Error('Sign out failed'));

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await act(async () => {
        await result.current.logout();
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(false);

      consoleWarnSpy.mockRestore();
    });

    it('should clear all storage on logout', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining(['@user_data', '@auth_tokens'])
      );
    });
  });

  describe('updateUser', () => {
    it('should update user data', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      const updatedData = {firstName: 'Updated', lastName: 'Name'};

      await act(async () => {
        await result.current.updateUser(updatedData);
      });

      expect(result.current.user?.firstName).toBe('Updated');
      expect(result.current.user?.lastName).toBe('Name');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@user_data',
        expect.stringContaining('Updated')
      );
    });

    it('should not update when user is null', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateUser({firstName: 'Test'});
      });

      expect(result.current.user).toBeNull();
    });
  });

  describe('refreshSession - Amplify', () => {
    it('should refresh Amplify session successfully', async () => {
      const mockAmplifyTokens = {
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

      mockFetchAuthSession.mockResolvedValue(mockAmplifyTokens as any);
      mockGetCurrentUser.mockResolvedValue({userId: 'amplify-user-id', username: 'test@example.com'} as any);
      mockFetchUserAttributes.mockResolvedValue({
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.provider).toBe('amplify');
    });

    it('should handle missing Amplify tokens', async () => {
      mockFetchAuthSession.mockResolvedValue({
        tokens: {
          idToken: null,
          accessToken: null,
        },
      } as any);
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(result.current.isLoggedIn).toBe(false);

      consoleLogSpy.mockRestore();
    });
  });

  describe('refreshSession - Firebase', () => {
    it('should refresh Firebase session successfully', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No Amplify session'));

      const mockFirebaseUser = {
        uid: 'firebase-user-id',
        email: 'firebase@example.com',
        photoURL: 'https://example.com/photo.jpg',
        reload: jest.fn(),
        getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
        getIdTokenResult: jest.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
        }),
      };

      mockGetAuth.mockReturnValue({
        currentUser: mockFirebaseUser,
      } as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.user?.email).toBe('firebase@example.com');
      expect(result.current.provider).toBe('firebase');
    });

    it('should handle Firebase user reload', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No Amplify session'));

      const mockReload = jest.fn();
      const mockFirebaseUser = {
        uid: 'firebase-user-id',
        email: 'firebase@example.com',
        reload: mockReload,
        getIdToken: jest.fn().mockResolvedValue('firebase-id-token'),
        getIdTokenResult: jest.fn().mockResolvedValue({
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
        }),
      };

      mockGetAuth.mockReturnValue({
        currentUser: mockFirebaseUser,
      } as any);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('refreshSession - Stored tokens', () => {
    it('should use stored tokens when no active session', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@user_data') {
          return Promise.resolve(JSON.stringify(mockUser));
        }
        return Promise.resolve(null);
      });

      mockLoadStoredTokens.mockResolvedValue(mockTokens);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLoggedIn).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should migrate legacy tokens', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      const legacyTokens = JSON.stringify({
        idToken: 'legacy-id-token',
        accessToken: 'legacy-access-token',
        provider: 'amplify',
      });

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@user_data') {
          return Promise.resolve(JSON.stringify(mockUser));
        }
        if (key === '@auth_tokens') {
          return Promise.resolve(legacyTokens);
        }
        return Promise.resolve(null);
      });

      mockLoadStoredTokens.mockResolvedValue(null);

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockStoreTokens).toHaveBeenCalled();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens');
    });
  });

  describe('Profile status handling', () => {
    it('should handle profile status warnings', async () => {
      mockFetchAuthSession.mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => 'id-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
          accessToken: {
            toString: () => 'access-token',
            payload: {exp: Math.floor(Date.now() / 1000) + 3600},
          },
        },
      } as any);

      mockGetCurrentUser.mockResolvedValue({userId: 'user-id', username: 'test@example.com'} as any);
      mockFetchUserAttributes.mockResolvedValue({email: 'test@example.com'});
      mockFetchProfileStatus.mockRejectedValue(new Error('Profile fetch failed'));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('AppState handling', () => {
    it('should refresh session when app becomes active', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);

      let appStateListener: ((state: string) => void) | undefined;
      (AppState.addEventListener as jest.Mock).mockImplementation((event, callback) => {
        appStateListener = callback;
        return {remove: jest.fn()};
      });

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Fast-forward time to allow refresh
      jest.advanceTimersByTime(65000);

      await act(async () => {
        appStateListener?.('active');
      });

      expect(appStateListener).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle storage errors during save', async () => {
      mockFetchAuthSession.mockRejectedValue(new Error('No session'));
      mockGetAuth.mockReturnValue({currentUser: null} as any);
      mockStoreTokens.mockRejectedValue(new Error('Storage failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const {result} = renderHook(() => useAuth(), {wrapper});

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login(mockUser, mockTokens);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist auth tokens securely',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
