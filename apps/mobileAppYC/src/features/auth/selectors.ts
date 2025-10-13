import type {RootState} from '@/app/store';

export const selectAuthState = (state: RootState) => state.auth;

export const selectAuthStatus = (state: RootState) => state.auth.status;

export const selectAuthUser = (state: RootState) => state.auth.user;

export const selectAuthProvider = (state: RootState) => state.auth.provider;

export const selectIsAuthenticated = (state: RootState) =>
  state.auth.status === 'authenticated' && !!state.auth.user;

export const selectAuthIsLoading = (state: RootState) =>
  state.auth.status === 'initializing' && !state.auth.initialized;

export const selectAuthIsRefreshing = (state: RootState) =>
  state.auth.isRefreshing;
