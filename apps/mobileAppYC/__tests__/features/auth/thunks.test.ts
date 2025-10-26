import {configureStore} from '@reduxjs/toolkit';
import {authReducer} from '@/features/auth';
import {themeReducer} from '@/features/theme';
import {companionReducer} from '@/features/companion';
import {
  initializeAuth,
  refreshSession,
  establishSession,
  updateUserProfile,
  logout,
  clearAuthError,
  __resetAuthListenersForTesting,
} from '@/features/auth/thunks';
import * as sessionManager from '@/features/auth/sessionManager';
import * as passwordlessAuth from '@/services/auth/passwordlessAuth';
import type {User, AuthTokens, NormalizedAuthTokens} from '@/features/auth/types';

jest.mock('@/features/auth/sessionManager');
jest.mock('@/services/auth/passwordlessAuth');
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    signOut: jest.fn(),
  })),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
      companion: companionReducer,
    },
  });
};

type TestStore = ReturnType<typeof createTestStore>;

describe('auth thunks', () => {
  let store: TestStore;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockTokens: NormalizedAuthTokens = {
    idToken: 'id-token-123',
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: Date.now() + 3600000,
    userId: 'user-123',
    provider: 'amplify',
  };

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    __resetAuthListenersForTesting();
  });

  describe('initializeAuth', () => {
    it('should initialize auth successfully with authenticated outcome', async () => {
      const dispatch = store.dispatch as any;
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(mockOutcome);
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(mockTokens);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(() => {});
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(state.initialized).toBe(true);
    });

    it('should handle pendingProfile outcome', async () => {
      const dispatch = store.dispatch as any;
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'pendingProfile',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(mockOutcome);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(() => {});
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(state.initialized).toBe(true);
    });

    it('should handle unauthenticated outcome', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'unauthenticated',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(mockOutcome);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(state.initialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      (sessionManager.recoverAuthSession as jest.Mock).mockRejectedValue(
        new Error('Recovery failed'),
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      // Error is set but then cleared by setUnauthenticated, so we just check status
    });

    it('should not re-initialize if already initialized', async () => {
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'amplify',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const recoverSpy = jest.spyOn(sessionManager, 'recoverAuthSession');
      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(recoverSpy).not.toHaveBeenCalled();
    });
  });

  describe('establishSession', () => {
    it('should establish a new session', async () => {
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(mockTokens);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(() => {});
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      const dispatch = store.dispatch as any;
      await dispatch(
        establishSession({
          user: mockUser,
          tokens: mockTokens,
        }),
      );

      const state = store.getState().auth;
      expect(state.status).toBe('authenticated');
      expect(state.user).toEqual(mockUser);
      expect(sessionManager.persistSessionData).toHaveBeenCalledWith(mockUser, mockTokens);
    });

    it('should default provider to amplify if not provided', async () => {
      const tokensWithoutProvider: AuthTokens = {...mockTokens, provider: undefined};
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(mockTokens);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(() => {});
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(() => {});

      const dispatch = store.dispatch as any;
      await dispatch(
        establishSession({
          user: mockUser,
          tokens: tokensWithoutProvider as AuthTokens,
        }),
      );

      expect(sessionManager.persistSessionData).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({provider: 'amplify'}),
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(mockOutcome);
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(mockTokens);
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(() => {});
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(() => {});

      const dispatch = store.dispatch as any;
      await dispatch(refreshSession());

      const state = store.getState().auth;
      expect(state.status).toBe('authenticated');
      expect(state.isRefreshing).toBe(false);
    });

    it('should handle refresh errors', async () => {
      (sessionManager.recoverAuthSession as jest.Mock).mockRejectedValue(
        new Error('Refresh failed'),
      );

      const dispatch = store.dispatch as any;
      await dispatch(refreshSession());

      const state = store.getState().auth;
      expect(state.error).toBe('Refresh failed');
      expect(state.isRefreshing).toBe(false);
    });

    it('should not refresh if already refreshing', async () => {
      store.dispatch({type: 'auth/setAuthRefreshing', payload: true});

      const recoverSpy = jest.spyOn(sessionManager, 'recoverAuthSession');
      const dispatch = store.dispatch as any;
      await dispatch(refreshSession());

      expect(recoverSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      (sessionManager.persistUserData as jest.Mock).mockResolvedValue(undefined);

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'amplify',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const updates = {firstName: 'Jane', lastName: 'Smith'};
      const dispatch = store.dispatch as any;
      await dispatch(updateUserProfile(updates));

      const state = store.getState().auth;
      expect(state.user?.firstName).toBe('Jane');
      expect(state.user?.lastName).toBe('Smith');
      expect(sessionManager.persistUserData).toHaveBeenCalledWith({
        ...mockUser,
        ...updates,
      });
    });

    it('should do nothing if no user is logged in', async () => {
      const persistSpy = jest.spyOn(sessionManager, 'persistUserData');

      const dispatch = store.dispatch as any;
      await dispatch(updateUserProfile({firstName: 'Jane'}));

      expect(persistSpy).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout amplify user', async () => {
      const signOutSpy = jest.spyOn(passwordlessAuth, 'signOutEverywhere').mockResolvedValue();
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(undefined);
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(() => {});

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'amplify',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      expect(signOutSpy).toHaveBeenCalled();
      expect(sessionManager.clearSessionData).toHaveBeenCalledWith({clearPendingProfile: true});

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
    });

    it('should logout firebase user', async () => {
      const mockSignOut = jest.fn();
      const {getAuth} = require('@react-native-firebase/auth');
      (getAuth as jest.Mock).mockReturnValue({
        currentUser: {uid: 'user-123'},
        signOut: mockSignOut,
      });

      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(undefined);
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(() => {});

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'firebase',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should handle logout errors gracefully', async () => {
      jest.spyOn(passwordlessAuth, 'signOutEverywhere').mockRejectedValue(new Error('Sign out failed'));
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(undefined);
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(() => {});

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'amplify',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
    });
  });

  describe('clearAuthError', () => {
    it('should clear auth error', async () => {
      store.dispatch({type: 'auth/setAuthError', payload: 'Some error'});

      const dispatch = store.dispatch as any;
      await dispatch(clearAuthError());

      const state = store.getState().auth;
      expect(state.error).toBeNull();
    });
  });
});
