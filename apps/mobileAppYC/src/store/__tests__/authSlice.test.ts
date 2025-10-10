import reducer, { clearAuthError, setUser, loginUser, registerUser, logoutUser, fetchProfileStatusThunk } from '@/store/slices/authSlice';
import type { AuthState, User } from '@/store/types';

describe('store/authSlice reducer', () => {
  const initial: AuthState = {
    isLoggedIn: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,
    profileExists: null,
    profileToken: null,
    profileStatusSource: null,
  };

  test('clearAuthError sets error to null', () => {
    const state = reducer({ ...initial, error: 'oops' }, clearAuthError());
    expect(state.error).toBeNull();
  });

  test('setUser updates user', () => {
    const user: User = { id: '1', email: 'u@e.com', name: 'U', createdAt: '', updatedAt: '' };
    const state = reducer(initial, setUser(user));
    expect(state.user).toEqual(user);
  });

  test('login pending/fulfilled transitions', () => {
    let state = reducer(initial, { type: loginUser.pending.type });
    expect(state.isLoading).toBe(true);
    const payload = { user: { id: '1', email: 'a@b.com', name: 'A', createdAt: '', updatedAt: '' }, token: 't' };
    state = reducer(state, { type: loginUser.fulfilled.type, payload });
    expect(state.isLoading).toBe(false);
    expect(state.isLoggedIn).toBe(true);
    expect(state.user?.email).toBe('a@b.com');
    expect(state.token).toBe('t');
  });

  test('register pending/rejected transitions', () => {
    let state = reducer(initial, { type: registerUser.pending.type });
    expect(state.isLoading).toBe(true);
    state = reducer(state, { type: registerUser.rejected.type, error: { message: 'bad' } });
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('bad');
  });

  test('logout pending/fulfilled resets state', () => {
    const logged: AuthState = { ...initial, isLoggedIn: true, user: { id: '1', email: 'a', name: 'n', createdAt: '', updatedAt: '' }, token: 't' };
    let state = reducer(logged, { type: logoutUser.pending.type });
    expect(state.isLoading).toBe(true);
    state = reducer(state, { type: logoutUser.fulfilled.type });
    expect(state).toEqual(initial);
  });

  test('fetchProfileStatus pending/fulfilled updates profile status fields', () => {
    let state = reducer(initial, { type: fetchProfileStatusThunk.pending.type });
    expect(state.isLoading).toBe(true);
    state = reducer(state, { type: fetchProfileStatusThunk.fulfilled.type, payload: { exists: true, profileToken: 'pt', source: 'app' } });
    expect(state.isLoading).toBe(false);
    expect(state.profileExists).toBe(true);
    expect(state.profileToken).toBe('pt');
    expect(state.profileStatusSource).toBe('app');
  });
});

