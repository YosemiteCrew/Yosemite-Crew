import {configureStore} from '@reduxjs/toolkit';
import {authReducer} from '@/features/auth';
import {themeReducer} from '@/features/theme';
import {companionReducer} from '@/features/companion';
import formsReducer from '@/features/forms/formsSlice';
import passportReducer from '@/features/passport/passportSlice';
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
import * as passwordlessAuth from '@/features/auth/services/passwordlessAuth';
import {__resetSuperTokensInitForTesting} from '@/features/auth/services/superTokensClient';
import type {
  User,
  AuthTokens,
  NormalizedAuthTokens,
} from '@/features/auth/types';

jest.mock('@/features/auth/sessionManager');
jest.mock('@/features/auth/services/passwordlessAuth');

const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
      companion: companionReducer,
      forms: formsReducer,
      passport: passportReducer,
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
    provider: 'supertokens',
  };

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
    __resetAuthListenersForTesting();
    __resetSuperTokensInitForTesting();
  });

  describe('initializeAuth', () => {
    it('should initialize auth successfully with authenticated outcome', async () => {
      const dispatch = store.dispatch as any;
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'supertokens',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

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

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(state.initialized).toBe(true);
    });

    it('should handle unauthenticated outcome', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'unauthenticated',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

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
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      // Error is set but then cleared by setUnauthenticated, so we just check status
    });

    it('should handle non-error initialization failures', async () => {
      (sessionManager.recoverAuthSession as jest.Mock).mockRejectedValue(
        'string failure',
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(store.getState().auth.status).toBe('unauthenticated');
    });

    it('should normalize missing token expiry to null during initialization', async () => {
      const tokensWithoutExpiry = {...mockTokens, expiresAt: undefined};
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: tokensWithoutExpiry,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        tokensWithoutExpiry,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(store.getState().auth.sessionExpiry).toBeNull();
    });

    it('should not re-initialize if already initialized', async () => {
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'supertokens',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const recoverSpy = jest.spyOn(sessionManager, 'recoverAuthSession');
      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(recoverSpy).not.toHaveBeenCalled();
    });

    it('should only register the app state listener once across multiple initializations', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());
      // Second call: state is already initialized, so it takes the early-skip
      // path, but ensureAppStateListener is still invoked and should no-op
      // since the listener was already registered by the first call.
      await dispatch(initializeAuth());

      expect(sessionManager.registerAppStateListener).toHaveBeenCalledTimes(1);
    });

    it('should dispatch a session refresh when the app state listener callback fires', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );

      let appStateCallback: (() => void) | undefined;
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        cb => {
          appStateCallback = cb;
        },
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(appStateCallback).toBeDefined();
      appStateCallback?.();

      // refreshSession sets isRefreshing true synchronously, then false once
      // its own recoverAuthSession promise resolves.
      expect(store.getState().auth.isRefreshing).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(store.getState().auth.isRefreshing).toBe(false);
    });

    it('should dispatch a session refresh when the scheduled refresh callback fires (authenticated outcome)', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'amplify',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      let scheduledCallback: (() => void) | undefined;
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        (_expiresAt, cb) => {
          scheduledCallback = cb;
        },
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(scheduledCallback).toBeDefined();
      scheduledCallback?.();

      expect(store.getState().auth.isRefreshing).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(store.getState().auth.isRefreshing).toBe(false);
    });

    it('should dispatch a session refresh when the scheduled refresh callback fires (pendingProfile outcome)', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'pendingProfile',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      let scheduledCallback: (() => void) | undefined;
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        (_expiresAt, cb) => {
          scheduledCallback = cb;
        },
      );

      const dispatch = store.dispatch as any;
      await dispatch(initializeAuth());

      expect(scheduledCallback).toBeDefined();
      scheduledCallback?.();

      expect(store.getState().auth.isRefreshing).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(store.getState().auth.isRefreshing).toBe(false);
    });
  });

  describe('establishSession', () => {
    it('should establish a new session', async () => {
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

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
      expect(sessionManager.persistSessionData).toHaveBeenCalledWith(
        mockUser,
        mockTokens,
      );
    });

    it('should default provider to supertokens if not provided', async () => {
      const tokensWithoutProvider: AuthTokens = {
        ...mockTokens,
        provider: undefined,
      };
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(
        establishSession({
          user: mockUser,
          tokens: tokensWithoutProvider as AuthTokens,
        }),
      );

      expect(sessionManager.persistSessionData).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({provider: 'supertokens'}),
      );
    });

    it('should default token userId to the user id and normalize missing expiry', async () => {
      const tokensWithoutUserId: AuthTokens = {
        ...mockTokens,
        userId: undefined,
        expiresAt: undefined,
      };
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue({
        ...mockTokens,
        expiresAt: undefined,
      });
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      const dispatch = store.dispatch as any;
      await dispatch(
        establishSession({
          user: mockUser,
          tokens: tokensWithoutUserId,
        }),
      );

      expect(sessionManager.persistSessionData).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({userId: mockUser.id}),
      );
      expect(store.getState().auth.sessionExpiry).toBeNull();
    });

    it('should dispatch a session refresh when the scheduled refresh callback fires', async () => {
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.registerAppStateListener as jest.Mock).mockImplementation(
        () => {},
      );

      let scheduledCallback: (() => void) | undefined;
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        (_expiresAt, cb) => {
          scheduledCallback = cb;
        },
      );

      const dispatch = store.dispatch as any;
      await dispatch(establishSession({user: mockUser, tokens: mockTokens}));

      expect(scheduledCallback).toBeDefined();
      scheduledCallback?.();

      expect(store.getState().auth.isRefreshing).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(store.getState().auth.isRefreshing).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockOutcome: sessionManager.RecoverAuthOutcome = {
        kind: 'authenticated',
        user: mockUser,
        tokens: mockTokens,
        provider: 'supertokens',
      };

      (sessionManager.recoverAuthSession as jest.Mock).mockResolvedValue(
        mockOutcome,
      );
      (sessionManager.persistSessionData as jest.Mock).mockResolvedValue(
        mockTokens,
      );
      (sessionManager.markAuthRefreshed as jest.Mock).mockImplementation(
        () => {},
      );
      (sessionManager.scheduleSessionRefresh as jest.Mock).mockImplementation(
        () => {},
      );

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

    it('should handle non-error refresh failures', async () => {
      (sessionManager.recoverAuthSession as jest.Mock).mockRejectedValue(
        'refresh string failure',
      );

      const dispatch = store.dispatch as any;
      await dispatch(refreshSession());

      const state = store.getState().auth;
      expect(state.error).toBe('Failed to refresh auth session.');
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
      (sessionManager.persistUserData as jest.Mock).mockResolvedValue(
        undefined,
      );

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'supertokens',
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
    it('should sign out via SuperTokens on logout', async () => {
      const signOutSpy = jest
        .spyOn(passwordlessAuth, 'signOutEverywhere')
        .mockResolvedValue();
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'supertokens',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });
      store.dispatch({
        type: 'forms/fetchAppointmentForms/fulfilled',
        payload: {
          appointmentId: 'appt-1',
          forms: [{form: {_id: 'f1'}, submission: null, status: 'pending'}],
          cache: {f1: {_id: 'f1'}},
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      expect(signOutSpy).toHaveBeenCalled();
      expect(sessionManager.clearSessionData).toHaveBeenCalledWith({
        clearPendingProfile: true,
      });

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(state.user).toBeNull();
      expect(store.getState().forms.byAppointmentId).toEqual({});
    });

    // Passport payloads carry the owner's name, email and phone, so they must
    // not survive into the next account signed in on the same device.
    it('clears every cached passport and request flag on logout', async () => {
      jest.spyOn(passwordlessAuth, 'signOutEverywhere').mockResolvedValue();
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

      store.dispatch({
        type: 'passport/fetchPassport/fulfilled',
        meta: {arg: {companionId: 'companion-123'}},
        payload: {
          companionId: 'companion-123',
          passport: {
            identity: {id: 'companion-123', name: 'Rex', species: 'DOG'},
            owner: {
              name: 'Prior Owner',
              email: 'prior@example.com',
              phone: '+15550001111',
            },
            vaccinations: [],
            parasiteTreatments: [],
            rabiesTitrations: [],
            clinicalExams: [],
          },
        },
      });
      store.dispatch({
        type: 'passport/fetchPassport/rejected',
        meta: {arg: {companionId: 'companion-456'}},
        payload: 'Failed to load passport',
        error: {message: 'Failed to load passport'},
      });

      // Guard: the cache really is populated before logout runs, so the
      // assertions below cannot pass vacuously.
      expect(store.getState().passport.byCompanionId).toHaveProperty(
        'companion-123',
      );
      expect(store.getState().passport.errorByCompanionId).toHaveProperty(
        'companion-456',
      );

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      expect(store.getState().passport).toEqual({
        byCompanionId: {},
        loadingByCompanionId: {},
        errorByCompanionId: {},
      });
    });

    it('re-initializes SuperTokens against the default API domain', async () => {
      const SuperTokens = require('supertokens-react-native').default;
      jest.spyOn(passwordlessAuth, 'signOutEverywhere').mockResolvedValue();
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'supertokens',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      expect(SuperTokens.init).toHaveBeenCalledWith(
        expect.objectContaining({
          apiBasePath: '/auth',
          tokenTransferMethod: 'header',
        }),
      );
    });

    it('should sign out via SuperTokens even without a current user object', async () => {
      (passwordlessAuth.signOutEverywhere as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

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

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(passwordlessAuth.signOutEverywhere).toHaveBeenCalledTimes(1);
    });

    it('should warn without rethrowing when SuperTokens sign out fails', async () => {
      (passwordlessAuth.signOutEverywhere as jest.Mock).mockRejectedValue(
        new Error('Sign out failed'),
      );
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

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

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(passwordlessAuth.signOutEverywhere).toHaveBeenCalledTimes(1);
    });

    it('should warn when SuperTokens sign out fails with an unrelated error', async () => {
      (passwordlessAuth.signOutEverywhere as jest.Mock).mockRejectedValue(
        new Error('SuperTokens sign out exploded'),
      );
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

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

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
      expect(passwordlessAuth.signOutEverywhere).toHaveBeenCalledTimes(1);
    });

    it('should handle logout errors gracefully', async () => {
      jest
        .spyOn(passwordlessAuth, 'signOutEverywhere')
        .mockRejectedValue(new Error('Sign out failed'));
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

      store.dispatch({
        type: 'auth/setAuthenticated',
        payload: {
          user: mockUser,
          provider: 'supertokens',
          sessionExpiry: null,
          lastRefresh: Date.now(),
        },
      });

      const dispatch = store.dispatch as any;
      await dispatch(logout());

      const state = store.getState().auth;
      expect(state.status).toBe('unauthenticated');
    });

    it('should restore development API config when dev API mode is enabled', async () => {
      const variables = require('@/config/variables');
      const previousUseDevApi = variables.MOBILE_CONFIG_BEHAVIOR.useDevApi;
      variables.MOBILE_CONFIG_BEHAVIOR.useDevApi = true;
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

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

      expect(variables.API_CONFIG.baseUrl).toBe(
        variables.DEVELOPMENT_API_BASE_URL,
      );
      variables.MOBILE_CONFIG_BEHAVIOR.useDevApi = previousUseDevApi;
    });

    it('should restore production API config when dev API mode is disabled', async () => {
      const variables = require('@/config/variables');
      const previousUseDevApi = variables.MOBILE_CONFIG_BEHAVIOR.useDevApi;
      variables.MOBILE_CONFIG_BEHAVIOR.useDevApi = false;
      (sessionManager.clearSessionData as jest.Mock).mockResolvedValue(
        undefined,
      );
      (sessionManager.resetAuthLifecycle as jest.Mock).mockImplementation(
        () => {},
      );

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

      expect(variables.API_CONFIG.baseUrl).toBe(
        variables.PRODUCTION_API_BASE_URL,
      );
      variables.MOBILE_CONFIG_BEHAVIOR.useDevApi = previousUseDevApi;
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
