import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  establishSession,
  initializeAuth,
  logout as logoutThunk,
  refreshSession as refreshSessionThunk,
  selectAuthState,
  updateUserProfile,
  type AuthProvider as AuthProviderName,
  type AuthTokens,
  type User,
} from '@/features/auth';
import {useAppDispatch, useAppSelector} from '@/app/hooks';

export type {AuthProviderName as AuthProviderType, AuthTokens, User};

interface AuthContextValue {
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  provider: AuthProviderName | null;
  login: (userData: User, tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector(selectAuthState);

  useEffect(() => {
    if (!authState.initialized && authState.status !== 'initializing') {
      dispatch(initializeAuth());
    }
  }, [authState.initialized, authState.status, dispatch]);

  const login = useCallback(
    async (userData: User, tokens: AuthTokens) => {
      await dispatch(establishSession({user: userData, tokens})).unwrap();
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    await dispatch(logoutThunk()).unwrap();
  }, [dispatch]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      await dispatch(updateUserProfile(updates)).unwrap();
    },
    [dispatch],
  );

  const refreshSession = useCallback(async () => {
    await dispatch(refreshSessionThunk()).unwrap();
  }, [dispatch]);

  const contextValue = useMemo<AuthContextValue>(() => {
    const isLoggedIn = authState.status === 'authenticated' && !!authState.user;
    const isLoading = authState.status === 'initializing' || (!authState.initialized && authState.status === 'idle');

    console.log('[AuthContext] State update:', {
      isLoggedIn,
      isLoading,
      status: authState.status,
      initialized: authState.initialized,
      userId: authState.user?.id,
      userEmail: authState.user?.email,
      provider: authState.provider,
      hasUser: !!authState.user,
    });

    return {
      isLoggedIn,
      isLoading,
      user: authState.user,
      provider: authState.provider,
      login,
      logout,
      updateUser,
      refreshSession,
    };
  }, [authState, login, logout, refreshSession, updateUser]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
