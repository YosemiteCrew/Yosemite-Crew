import {createAsyncThunk} from '@reduxjs/toolkit';

import {AppDispatch, type RootState} from '@/app/store';
import {signOutEverywhere} from '@/features/auth/services/passwordlessAuth';
import {getAuth} from '@react-native-firebase/auth';

import {
  mergeUser,
  resetAuthState,
  setAuthError,
  setAuthInitializing,
  setAuthRefreshing,
  setAuthenticated,
  setLastRefresh,
  setSessionExpiry,
  setUnauthenticated,
} from './authSlice';
import type {AuthTokens, User} from './types';
import {
  clearSessionData,
  markAuthRefreshed,
  persistSessionData,
  persistUserData,
  recoverAuthSession,
  registerAppStateListener,
  resetAuthLifecycle,
  scheduleSessionRefresh,
  type RecoverAuthOutcome,
} from './sessionManager';

let appStateListenerRegistered = false;

const ensureAppStateListener = (dispatch: AppDispatch) => {
  if (appStateListenerRegistered) {
    return;
  }

  registerAppStateListener(() => {
    dispatch(refreshSession());
  });

  appStateListenerRegistered = true;
};

const applyRecoverOutcome = async (
  outcome: RecoverAuthOutcome,
  dispatch: AppDispatch,
) => {
  switch (outcome.kind) {
    case 'authenticated': {
      const normalizedTokens = await persistSessionData(
        outcome.user,
        outcome.tokens,
      );

      const now = Date.now();

      dispatch(
        setAuthenticated({
          user: outcome.user,
          provider: outcome.provider,
          sessionExpiry: normalizedTokens.expiresAt ?? null,
          lastRefresh: now,
        }),
      );
      markAuthRefreshed(now);

      scheduleSessionRefresh(normalizedTokens.expiresAt, () => {
        dispatch(refreshSession());
      });
      return 'authenticated';
    }
    case 'pendingProfile': {
      dispatch(setUnauthenticated());
      markAuthRefreshed();
      scheduleSessionRefresh(undefined, () => {
        dispatch(refreshSession());
      });
      return 'pendingProfile';
    }
    case 'unauthenticated':
    default: {
      dispatch(setUnauthenticated());
      markAuthRefreshed();
      return 'unauthenticated';
    }
  }
};

export const initializeAuth = createAsyncThunk<
  void,
  void,
  {state: RootState; dispatch: AppDispatch}
>('auth/initialize', async (_, {dispatch, getState}) => {
  const state = getState().auth;

  console.log('[Auth] initializeAuth called with state:', {
    status: state.status,
    initialized: state.initialized,
    hasUser: !!state.user,
  });

  // Don't re-initialize if already initialized or currently initializing
  if (state.initialized || state.status === 'initializing') {
    console.log('[Auth] Already initialized or initializing, skipping');
    ensureAppStateListener(dispatch);
    return;
  }

  console.log('[Auth] Starting auth initialization');
  dispatch(setAuthInitializing());
  ensureAppStateListener(dispatch);

  try {
    const outcome = await recoverAuthSession();
    const result = await applyRecoverOutcome(outcome, dispatch);
    console.log('[Auth] Initialization complete with outcome:', result);
  } catch (error) {
    console.error('[Auth] Failed to initialize auth session', error);
    dispatch(
      setAuthError(
        error instanceof Error ? error.message : 'Failed to initialize auth session.',
      ),
    );
    dispatch(setUnauthenticated());
  }
});

export const establishSession = createAsyncThunk<
  void,
  {user: User; tokens: AuthTokens},
  {dispatch: AppDispatch}
>('auth/establishSession', async ({user, tokens}, {dispatch}) => {
  ensureAppStateListener(dispatch);

  const normalizedTokens = await persistSessionData(user, {
    ...tokens,
    userId: tokens.userId ?? user.id,
    provider: tokens.provider ?? 'amplify',
  });

  const now = Date.now();

  dispatch(
    setAuthenticated({
      user,
      provider: normalizedTokens.provider,
      sessionExpiry: normalizedTokens.expiresAt ?? null,
      lastRefresh: now,
    }),
  );

  markAuthRefreshed(now);
  scheduleSessionRefresh(normalizedTokens.expiresAt, () => {
    dispatch(refreshSession());
  });
});

export const refreshSession = createAsyncThunk<
  void,
  void,
  {state: RootState; dispatch: AppDispatch}
>(
  'auth/refreshSession',
  async (_, {dispatch}) => {
    dispatch(setAuthRefreshing(true));

    try {
      const outcome = await recoverAuthSession();
      await applyRecoverOutcome(outcome, dispatch);
    } catch (error) {
      console.error('[Auth] Failed to refresh auth session', error);
      dispatch(
        setAuthError(
          error instanceof Error ? error.message : 'Failed to refresh auth session.',
        ),
      );
    } finally {
      dispatch(setAuthRefreshing(false));
    }
  },
  {
    condition: (_, {getState}) => {
      const state = getState().auth;
      return !state.isRefreshing;
    },
  },
);

export const updateUserProfile = createAsyncThunk<
  void,
  Partial<User>,
  {state: RootState; dispatch: AppDispatch}
>('auth/updateUserProfile', async (updates, {dispatch, getState}) => {
  const currentUser = getState().auth.user;

  if (!currentUser) {
    return;
  }

  const updatedUser: User = {
    ...currentUser,
    ...updates,
  };

  await persistUserData(updatedUser);
  dispatch(mergeUser(updates));
});

export const logout = createAsyncThunk<void, void, {state: RootState; dispatch: AppDispatch}>(
  'auth/logout',
  async (_, {dispatch, getState}) => {
    const currentProvider = getState().auth.provider;

    try {
      if (currentProvider === 'amplify') {
        await signOutEverywhere();
      }
    } catch (error) {
      console.warn('[Auth] Amplify sign out failed:', error);
    }

    try {
      const fb = getAuth();
      if (currentProvider === 'firebase' || fb.currentUser) {
        await fb.signOut();
      }
    } catch (error) {
      console.warn('[Auth] Firebase sign out failed:', error);
    }

    await clearSessionData({clearPendingProfile: true});
    resetAuthLifecycle({clearPendingProfile: true});
    appStateListenerRegistered = false;

    dispatch(resetAuthState());
    dispatch(setUnauthenticated());
    dispatch(setSessionExpiry(null));
    dispatch(setLastRefresh(null));
  },
);

export const clearAuthError = createAsyncThunk('auth/clearError', async (_, {dispatch}) => {
  dispatch(setAuthError(null));
});

export const __resetAuthListenersForTesting = () => {
  appStateListenerRegistered = false;
};
