import authReducer, {
  loginUser,
  registerUser,
  logoutUser,
  fetchProfileStatusThunk,
  clearAuthError,
  setUser,
} from '@/store/slices/authSlice';
import {AuthState, User} from '@/store/types';
import {configureStore} from '@reduxjs/toolkit';

// Mock the profile service
jest.mock('@/services/profile/profileService', () => ({
  fetchProfileStatus: jest.fn(),
}));

const {fetchProfileStatus} = require('@/services/profile/profileService');

describe('authSlice', () => {
  const initialState: AuthState = {
    isLoggedIn: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,
    profileExists: null,
    profileToken: null,
    profileStatusSource: null,
  };

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('initial state', () => {
    it('should return the initial state', () => {
      expect(authReducer(undefined, {type: 'unknown'})).toEqual(initialState);
    });
  });

  describe('reducers', () => {
    it('should handle clearAuthError', () => {
      const stateWithError: AuthState = {
        ...initialState,
        error: 'Some error',
      };
      const nextState = authReducer(stateWithError, clearAuthError());
      expect(nextState.error).toBeNull();
    });

    it('should handle setUser', () => {
      const nextState = authReducer(initialState, setUser(mockUser));
      expect(nextState.user).toEqual(mockUser);
    });
  });

  describe('loginUser thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: loginUser.pending.type};
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const store = configureStore({
        reducer: {auth: authReducer},
      });

      const loginPromise = store.dispatch(
        loginUser({email: 'test@example.com', password: 'password123'}),
      );

      jest.advanceTimersByTime(1000);
      await loginPromise;

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(true);
      expect(state.user).toBeDefined();
      expect(state.user?.email).toBe('test@example.com');
      expect(state.token).toBe('mock-jwt-token');
      expect(state.error).toBeNull();
      expect(state.profileExists).toBeNull();
      expect(state.profileToken).toBeNull();
      expect(state.profileStatusSource).toBeNull();
    });

    it('should handle rejected state', () => {
      const action = {
        type: loginUser.rejected.type,
        error: {message: 'Invalid credentials'},
      };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid credentials');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: loginUser.rejected.type,
        error: {},
      };
      const state = authReducer(initialState, action);
      expect(state.error).toBe('Login failed');
    });
  });

  describe('registerUser thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: registerUser.pending.type};
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const store = configureStore({
        reducer: {auth: authReducer},
      });

      const registerPromise = store.dispatch(
        registerUser({
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        }),
      );

      jest.advanceTimersByTime(1500);
      await registerPromise;

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.isLoggedIn).toBe(true);
      expect(state.user).toBeDefined();
      expect(state.user?.email).toBe('newuser@example.com');
      expect(state.user?.name).toBe('New User');
      expect(state.token).toBe('mock-jwt-token');
      expect(state.profileExists).toBeNull();
      expect(state.profileToken).toBeNull();
      expect(state.profileStatusSource).toBeNull();
    });

    it('should handle rejected state', () => {
      const action = {
        type: registerUser.rejected.type,
        error: {message: 'Email already exists'},
      };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Email already exists');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: registerUser.rejected.type,
        error: {},
      };
      const state = authReducer(initialState, action);
      expect(state.error).toBe('Registration failed');
    });
  });

  describe('logoutUser thunk', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle pending state', () => {
      const action = {type: logoutUser.pending.type};
      const state = authReducer({...initialState, isLoggedIn: true}, action);
      expect(state.isLoading).toBe(true);
    });

    it('should handle fulfilled state and reset to initial state', async () => {
      const loggedInState: AuthState = {
        isLoggedIn: true,
        user: mockUser,
        token: 'some-token',
        isLoading: false,
        error: null,
        profileExists: true,
        profileToken: 'profile-token',
        profileStatusSource: 'remote',
      };

      const store = configureStore({
        reducer: {auth: authReducer},
        preloadedState: {auth: loggedInState},
      });

      const logoutPromise = store.dispatch(logoutUser());

      jest.advanceTimersByTime(500);
      await logoutPromise;

      const state = store.getState().auth;
      expect(state).toEqual(initialState);
    });

    it('should handle rejected state', () => {
      const action = {type: logoutUser.rejected.type};
      const state = authReducer({...initialState, isLoading: true}, action);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('fetchProfileStatusThunk', () => {
    beforeEach(() => {
      fetchProfileStatus.mockClear();
    });

    it('should handle pending state', () => {
      const action = {type: fetchProfileStatusThunk.pending.type};
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should handle fulfilled state', async () => {
      const mockProfileStatus = {
        exists: true,
        profileToken: 'profile-token-123',
        source: 'amplify' as const,
      };

      fetchProfileStatus.mockResolvedValue(mockProfileStatus);

      const store = configureStore({
        reducer: {auth: authReducer},
      });

      await store.dispatch(
        fetchProfileStatusThunk({
          accessToken: 'test-token',
          userId: 'user-123',
          email: 'test@example.com',
        }),
      );

      const state = store.getState().auth;
      expect(state.isLoading).toBe(false);
      expect(state.profileExists).toBe(true);
      expect(state.profileToken).toBe('profile-token-123');
      expect(state.profileStatusSource).toBe('amplify');
    });

    it('should handle fulfilled state when profile does not exist', async () => {
      const mockProfileStatus = {
        exists: false,
        profileToken: null,
        source: 'amplify' as const,
      };

      fetchProfileStatus.mockResolvedValue(mockProfileStatus);

      const store = configureStore({
        reducer: {auth: authReducer},
      });

      await store.dispatch(
        fetchProfileStatusThunk({
          accessToken: 'test-token',
          userId: 'user-123',
          email: 'test@example.com',
        }),
      );

      const state = store.getState().auth;
      expect(state.profileExists).toBe(false);
      expect(state.profileToken).toBeNull();
    });

    it('should handle rejected state', () => {
      const action = {
        type: fetchProfileStatusThunk.rejected.type,
        error: {message: 'Network error'},
      };
      const state = authReducer(initialState, action);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle rejected state with default message', () => {
      const action = {
        type: fetchProfileStatusThunk.rejected.type,
        error: {},
      };
      const state = authReducer(initialState, action);
      expect(state.error).toBe('Profile status lookup failed');
    });
  });

  describe('combined scenarios', () => {
    it('should clear error after login success', () => {
      let state: AuthState = {
        ...initialState,
        error: 'Previous error',
      };

      state = authReducer(state, {type: loginUser.pending.type});
      expect(state.error).toBeNull();
    });

    it('should maintain user data when fetching profile status', async () => {
      const loggedInState: AuthState = {
        ...initialState,
        isLoggedIn: true,
        user: mockUser,
        token: 'user-token',
      };

      fetchProfileStatus.mockResolvedValue({
        exists: true,
        profileToken: 'profile-token',
        source: 'amplify',
      });

      const store = configureStore({
        reducer: {auth: authReducer},
        preloadedState: {auth: loggedInState},
      });

      await store.dispatch(
        fetchProfileStatusThunk({
          accessToken: 'test-token',
          userId: 'user-123',
          email: 'test@example.com',
        }),
      );

      const state = store.getState().auth;
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('user-token');
      expect(state.profileExists).toBe(true);
    });
  });
});
