import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

import type {AuthProvider, AuthState, User} from './types';

const initialState: AuthState = {
  status: 'idle',
  initialized: false,
  user: null,
  provider: null,
  sessionExpiry: null,
  lastRefresh: null,
  isRefreshing: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthInitializing(state) {
      state.status = 'initializing';
      state.error = null;
      state.isRefreshing = false;
      state.sessionExpiry = null;
      state.lastRefresh = null;
    },
    setAuthenticated(
      state,
      action: PayloadAction<{
        user: User;
        provider: AuthProvider;
        sessionExpiry?: number | null;
        lastRefresh?: number | null;
      }>,
    ) {
      state.status = 'authenticated';
      state.user = action.payload.user;
      state.provider = action.payload.provider;
      state.sessionExpiry =
        typeof action.payload.sessionExpiry === 'number'
          ? action.payload.sessionExpiry
          : null;
      state.lastRefresh =
        typeof action.payload.lastRefresh === 'number'
          ? action.payload.lastRefresh
          : Date.now();
      state.error = null;
      state.isRefreshing = false;
      state.initialized = true;
    },
    setUnauthenticated(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.provider = null;
      state.sessionExpiry = null;
      state.lastRefresh = Date.now();
      state.isRefreshing = false;
      state.error = null;
      state.initialized = true;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload ?? null;
    },
    setAuthRefreshing(state, action: PayloadAction<boolean>) {
      state.isRefreshing = action.payload;
    },
    mergeUser(state, action: PayloadAction<Partial<User>>) {
      if (!state.user) {
        return;
      }

      state.user = {
        ...state.user,
        ...action.payload,
      };
    },
    setSessionExpiry(state, action: PayloadAction<number | null>) {
      state.sessionExpiry =
        typeof action.payload === 'number' ? action.payload : null;
    },
    setLastRefresh(state, action: PayloadAction<number | null>) {
      state.lastRefresh =
        typeof action.payload === 'number' ? action.payload : null;
    },
    resetAuthState() {
      return initialState;
    },
  },
});

export const {
  setAuthInitializing,
  setAuthenticated,
  setUnauthenticated,
  setAuthError,
  setAuthRefreshing,
  mergeUser,
  setSessionExpiry,
  setLastRefresh,
  resetAuthState,
} = authSlice.actions;

export default authSlice.reducer;
