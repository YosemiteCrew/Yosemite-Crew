import authReducer, {
  setAuthInitializing,
  setAuthenticated,
  setUnauthenticated,
  setAuthError,
  setAuthRefreshing,
  mergeUser,
  setSessionExpiry,
  setLastRefresh,
  resetAuthState,
} from '@/features/auth/authSlice';
import type {AuthState, User} from '@/features/auth/types';

describe('authSlice', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    dateOfBirth: '1990-01-01',
    profilePicture: 'https://example.com/pic.jpg',
  };

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

  it('should return the initial state', () => {
    expect(authReducer(undefined, {type: 'unknown'})).toEqual(initialState);
  });

  describe('setAuthInitializing', () => {
    it('should set status to initializing and clear error', () => {
      const previousState: AuthState = {
        ...initialState,
        status: 'authenticated',
        error: 'Some error',
        isRefreshing: true,
        sessionExpiry: 123456,
        lastRefresh: 789012,
      };

      const nextState = authReducer(previousState, setAuthInitializing());

      expect(nextState.status).toBe('initializing');
      expect(nextState.error).toBeNull();
      expect(nextState.isRefreshing).toBe(false);
      expect(nextState.sessionExpiry).toBeNull();
      expect(nextState.lastRefresh).toBeNull();
    });
  });

  describe('setAuthenticated', () => {
    it('should set authenticated state with user and provider', () => {
      const sessionExpiry = Date.now() + 3600000;
      const lastRefresh = Date.now();

      const nextState = authReducer(
        initialState,
        setAuthenticated({
          user: mockUser,
          provider: 'amplify',
          sessionExpiry,
          lastRefresh,
        }),
      );

      expect(nextState.status).toBe('authenticated');
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.provider).toBe('amplify');
      expect(nextState.sessionExpiry).toBe(sessionExpiry);
      expect(nextState.lastRefresh).toBe(lastRefresh);
      expect(nextState.error).toBeNull();
      expect(nextState.isRefreshing).toBe(false);
      expect(nextState.initialized).toBe(true);
    });

    it('should handle null sessionExpiry', () => {
      const nextState = authReducer(
        initialState,
        setAuthenticated({
          user: mockUser,
          provider: 'firebase',
          sessionExpiry: null,
        }),
      );

      expect(nextState.sessionExpiry).toBeNull();
      expect(nextState.lastRefresh).toBeCloseTo(Date.now(), -2);
    });

    it('should use Date.now() for lastRefresh if not provided', () => {
      const before = Date.now();
      const nextState = authReducer(
        initialState,
        setAuthenticated({
          user: mockUser,
          provider: 'amplify',
        }),
      );
      const after = Date.now();

      expect(nextState.lastRefresh).toBeGreaterThanOrEqual(before);
      expect(nextState.lastRefresh).toBeLessThanOrEqual(after);
    });
  });

  describe('setUnauthenticated', () => {
    it('should clear all auth data', () => {
      const authenticatedState: AuthState = {
        status: 'authenticated',
        initialized: true,
        user: mockUser,
        provider: 'amplify',
        sessionExpiry: 123456,
        lastRefresh: 789012,
        isRefreshing: true,
        error: 'Some error',
      };

      const nextState = authReducer(authenticatedState, setUnauthenticated());

      expect(nextState.status).toBe('unauthenticated');
      expect(nextState.user).toBeNull();
      expect(nextState.provider).toBeNull();
      expect(nextState.sessionExpiry).toBeNull();
      expect(nextState.lastRefresh).toBeCloseTo(Date.now(), -2);
      expect(nextState.isRefreshing).toBe(false);
      expect(nextState.error).toBeNull();
      expect(nextState.initialized).toBe(true);
    });
  });

  describe('setAuthError', () => {
    it('should set error message', () => {
      const errorMessage = 'Authentication failed';
      const nextState = authReducer(
        initialState,
        setAuthError(errorMessage),
      );

      expect(nextState.error).toBe(errorMessage);
    });

    it('should handle null error', () => {
      const previousState: AuthState = {
        ...initialState,
        error: 'Previous error',
      };

      const nextState = authReducer(previousState, setAuthError(null));

      expect(nextState.error).toBeNull();
    });
  });

  describe('setAuthRefreshing', () => {
    it('should set isRefreshing to true', () => {
      const nextState = authReducer(
        initialState,
        setAuthRefreshing(true),
      );

      expect(nextState.isRefreshing).toBe(true);
    });

    it('should set isRefreshing to false', () => {
      const previousState: AuthState = {
        ...initialState,
        isRefreshing: true,
      };

      const nextState = authReducer(previousState, setAuthRefreshing(false));

      expect(nextState.isRefreshing).toBe(false);
    });
  });

  describe('mergeUser', () => {
    it('should merge partial user data', () => {
      const authenticatedState: AuthState = {
        ...initialState,
        user: mockUser,
        status: 'authenticated',
      };

      const nextState = authReducer(
        authenticatedState,
        mergeUser({
          firstName: 'Jane',
          lastName: 'Smith',
        }),
      );

      expect(nextState.user).toEqual({
        ...mockUser,
        firstName: 'Jane',
        lastName: 'Smith',
      });
    });

    it('should do nothing if user is null', () => {
      const nextState = authReducer(
        initialState,
        mergeUser({
          firstName: 'Jane',
        }),
      );

      expect(nextState.user).toBeNull();
    });

    it('should handle single field update', () => {
      const authenticatedState: AuthState = {
        ...initialState,
        user: mockUser,
        status: 'authenticated',
      };

      const nextState = authReducer(
        authenticatedState,
        mergeUser({
          phone: '+9876543210',
        }),
      );

      expect(nextState.user?.phone).toBe('+9876543210');
      expect(nextState.user?.email).toBe(mockUser.email);
    });
  });

  describe('setSessionExpiry', () => {
    it('should set session expiry with number', () => {
      const expiry = Date.now() + 3600000;
      const nextState = authReducer(initialState, setSessionExpiry(expiry));

      expect(nextState.sessionExpiry).toBe(expiry);
    });

    it('should set session expiry to null', () => {
      const previousState: AuthState = {
        ...initialState,
        sessionExpiry: 123456,
      };

      const nextState = authReducer(previousState, setSessionExpiry(null));

      expect(nextState.sessionExpiry).toBeNull();
    });
  });

  describe('setLastRefresh', () => {
    it('should set last refresh with number', () => {
      const timestamp = Date.now();
      const nextState = authReducer(initialState, setLastRefresh(timestamp));

      expect(nextState.lastRefresh).toBe(timestamp);
    });

    it('should set last refresh to null', () => {
      const previousState: AuthState = {
        ...initialState,
        lastRefresh: 123456,
      };

      const nextState = authReducer(previousState, setLastRefresh(null));

      expect(nextState.lastRefresh).toBeNull();
    });
  });

  describe('resetAuthState', () => {
    it('should reset to initial state', () => {
      const dirtyState: AuthState = {
        status: 'authenticated',
        initialized: true,
        user: mockUser,
        provider: 'firebase',
        sessionExpiry: 123456,
        lastRefresh: 789012,
        isRefreshing: true,
        error: 'Some error',
      };

      const nextState = authReducer(dirtyState, resetAuthState());

      expect(nextState).toEqual(initialState);
    });
  });
});
