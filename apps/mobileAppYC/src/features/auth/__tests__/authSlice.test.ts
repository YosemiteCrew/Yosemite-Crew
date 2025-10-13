import reducer, {
  mergeUser,
  resetAuthState,
  setAuthError,
  setAuthInitializing,
  setAuthRefreshing,
  setAuthenticated,
  setLastRefresh,
  setSessionExpiry,
  setUnauthenticated,
} from '@/features/auth/authSlice';
import type {AuthState, User} from '@/features/auth';

const baseState = (): AuthState =>
  reducer(undefined, {type: '@@INIT'}) as AuthState;

const sampleUser: User = {
  id: 'user-123',
  email: 'user@example.com',
  firstName: 'Test',
  lastName: 'User',
  profileToken: 'profile-token',
};

describe('authSlice reducers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('setAuthInitializing resets transient fields', () => {
    const startingState: AuthState = {
      ...baseState(),
      status: 'authenticated',
      error: 'boom',
      isRefreshing: true,
      sessionExpiry: 123,
      lastRefresh: 456,
    };

    const result = reducer(startingState, setAuthInitializing());

    expect(result.status).toBe('initializing');
    expect(result.error).toBeNull();
    expect(result.isRefreshing).toBe(false);
    expect(result.sessionExpiry).toBeNull();
    expect(result.lastRefresh).toBeNull();
  });

  it('setAuthenticated stores user data and marks initialized', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1111);

    const result = reducer(
      baseState(),
      setAuthenticated({
        user: sampleUser,
        provider: 'amplify',
        sessionExpiry: 999,
      }),
    );

    expect(result.status).toBe('authenticated');
    expect(result.user).toEqual(sampleUser);
    expect(result.provider).toBe('amplify');
    expect(result.sessionExpiry).toBe(999);
    expect(result.lastRefresh).toBe(1111);
    expect(result.initialized).toBe(true);
    expect(result.error).toBeNull();
    expect(result.isRefreshing).toBe(false);
  });

  it('setUnauthenticated clears user and provider state', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2222);

    const startingState: AuthState = {
      ...baseState(),
      status: 'authenticated',
      user: sampleUser,
      provider: 'firebase',
      sessionExpiry: 123,
      lastRefresh: 1000,
      initialized: true,
    };

    const result = reducer(startingState, setUnauthenticated());

    expect(result.status).toBe('unauthenticated');
    expect(result.user).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.sessionExpiry).toBeNull();
    expect(result.lastRefresh).toBe(2222);
    expect(result.initialized).toBe(true);
  });

  it('setAuthError updates error field', () => {
    const withError = reducer(baseState(), setAuthError('failure'));
    expect(withError.error).toBe('failure');

    const cleared = reducer(withError, setAuthError(null));
    expect(cleared.error).toBeNull();
  });

  it('setAuthRefreshing toggles refresh state', () => {
    const refreshing = reducer(baseState(), setAuthRefreshing(true));
    expect(refreshing.isRefreshing).toBe(true);

    const notRefreshing = reducer(refreshing, setAuthRefreshing(false));
    expect(notRefreshing.isRefreshing).toBe(false);
  });

  it('mergeUser updates existing user details', () => {
    const startingState: AuthState = {
      ...baseState(),
      status: 'authenticated',
      user: sampleUser,
    };

    const result = reducer(
      startingState,
      mergeUser({firstName: 'Updated', profileToken: 'new-token'}),
    );

    expect(result.user).toEqual(
      expect.objectContaining({firstName: 'Updated', profileToken: 'new-token'}),
    );
  });

  it('mergeUser is a no-op when no user present', () => {
    const result = reducer(baseState(), mergeUser({firstName: 'Ignored'}));
    expect(result.user).toBeNull();
  });

  it('setSessionExpiry and setLastRefresh store numeric values', () => {
    const withExpiry = reducer(baseState(), setSessionExpiry(555));
    expect(withExpiry.sessionExpiry).toBe(555);

    const clearedExpiry = reducer(withExpiry, setSessionExpiry(null));
    expect(clearedExpiry.sessionExpiry).toBeNull();

    const withRefresh = reducer(baseState(), setLastRefresh(666));
    expect(withRefresh.lastRefresh).toBe(666);

    const clearedRefresh = reducer(withRefresh, setLastRefresh(null));
    expect(clearedRefresh.lastRefresh).toBeNull();
  });

  it('resetAuthState returns the initial slice state', () => {
    const mutated: AuthState = {
      ...baseState(),
      status: 'authenticated',
      user: sampleUser,
      provider: 'amplify',
      initialized: true,
    };

    const result = reducer(mutated, resetAuthState());

    expect(result).toEqual(baseState());
  });
});
