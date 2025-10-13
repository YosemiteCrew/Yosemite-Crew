import {configureStore} from '@reduxjs/toolkit';

import {
  __resetAuthListenersForTesting,
  authReducer,
  establishSession,
  initializeAuth,
  logout,
  refreshSession,
} from '@/features/auth';
import type {AuthTokens, User, NormalizedAuthTokens} from '@/features/auth';
import {themeReducer} from '@/features/theme';

import {signOutEverywhere} from '@/services/auth/passwordlessAuth';
import {getAuth} from '@react-native-firebase/auth';

import {
  clearSessionData,
  markAuthRefreshed,
  persistSessionData,
  recoverAuthSession,
  registerAppStateListener,
  resetAuthLifecycle,
  scheduleSessionRefresh,
} from '@/features/auth/sessionManager';

jest.mock('@/services/auth/passwordlessAuth', () => ({
  signOutEverywhere: jest.fn(),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('@/features/auth/sessionManager', () => ({
  persistSessionData: jest.fn(),
  recoverAuthSession: jest.fn(),
  registerAppStateListener: jest.fn(),
  scheduleSessionRefresh: jest.fn(),
  clearSessionData: jest.fn(),
  resetAuthLifecycle: jest.fn(),
  markAuthRefreshed: jest.fn(),
  persistUserData: jest.fn(),
}));

const mockPersistSessionData = jest.mocked(persistSessionData);
const mockRecoverAuthSession = jest.mocked(recoverAuthSession);
const mockScheduleSessionRefresh = jest.mocked(scheduleSessionRefresh);
const mockRegisterAppStateListener = jest.mocked(registerAppStateListener);
const mockClearSessionData = jest.mocked(clearSessionData);
const mockResetAuthLifecycle = jest.mocked(resetAuthLifecycle);
const mockSignOutEverywhere = jest.mocked(signOutEverywhere);
const mockGetAuth = jest.mocked(getAuth);
const mockMarkAuthRefreshed = jest.mocked(markAuthRefreshed);

const createStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      theme: themeReducer,
    },
  });

type TestStore = ReturnType<typeof createStore>;
type TestDispatch = TestStore['dispatch'];

const buildUser = (): User => ({
  id: 'test-user',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  profileToken: 'profile-token',
});

const buildTokens = (): AuthTokens => ({
  idToken: 'id-token',
  accessToken: 'access-token',
  provider: 'amplify',
  userId: 'test-user',
});

describe('auth thunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetAuthListenersForTesting();
  });

  it('establishSession persists session and updates state', async () => {
    const store = createStore();
    const dispatch = store.dispatch as TestDispatch;
    const user = buildUser();
    const tokens = buildTokens();

    mockPersistSessionData.mockResolvedValue({
      ...tokens,
      expiresAt: Date.now() + 60_000,
      userId: tokens.userId!,
      provider: tokens.provider ?? 'amplify',
    });

    await dispatch(establishSession({user, tokens}));

    const state = store.getState().auth;
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(user);
    expect(state.provider).toBe('amplify');
    expect(mockPersistSessionData).toHaveBeenCalledWith(user, {
      ...tokens,
      userId: tokens.userId,
      provider: tokens.provider,
    });
    expect(mockScheduleSessionRefresh).toHaveBeenCalledTimes(1);
    expect(mockRegisterAppStateListener).toHaveBeenCalledTimes(1);
    expect(mockMarkAuthRefreshed).toHaveBeenCalled();
  });

  it('initializeAuth hydrates existing authenticated session', async () => {
    const store = createStore();
    const dispatch = store.dispatch as TestDispatch;
    const user = buildUser();
    const tokens: NormalizedAuthTokens = {
      ...buildTokens(),
      expiresAt: Date.now() + 120_000,
      userId: 'test-user',
      provider: 'amplify',
    };

    mockRecoverAuthSession.mockResolvedValue({
      kind: 'authenticated',
      user,
      tokens,
      provider: 'amplify',
    });
    mockPersistSessionData.mockResolvedValue(tokens);

    await dispatch(initializeAuth());

    const state = store.getState().auth;
    expect(state.status).toBe('authenticated');
    expect(state.user?.id).toBe(user.id);
    expect(mockRecoverAuthSession).toHaveBeenCalled();
    expect(mockScheduleSessionRefresh).toHaveBeenCalled();
  });

  it('refreshSession handles unauthenticated outcome', async () => {
    const store = createStore();
    const dispatch = store.dispatch as TestDispatch;

    mockRecoverAuthSession.mockResolvedValue({kind: 'unauthenticated'});

    await dispatch(refreshSession());

    const state = store.getState().auth;
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
  });

  it('logout clears session, tokens, and resets lifecycle hooks', async () => {
    const store = createStore();
    const dispatch = store.dispatch as TestDispatch;

    mockPersistSessionData.mockResolvedValue({
      ...buildTokens(),
      expiresAt: Date.now() + 60_000,
      userId: 'test-user',
      provider: 'amplify',
    });

    await dispatch(establishSession({user: buildUser(), tokens: buildTokens()}));

    mockClearSessionData.mockResolvedValue();
    mockResetAuthLifecycle.mockReturnValue();
    mockSignOutEverywhere.mockResolvedValue(undefined as unknown as void);
    mockGetAuth.mockReturnValue({signOut: jest.fn(), currentUser: null} as any);

    await dispatch(logout());

    const state = store.getState().auth;
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
    expect(mockClearSessionData).toHaveBeenCalledWith({clearPendingProfile: true});
    expect(mockResetAuthLifecycle).toHaveBeenCalledWith({clearPendingProfile: true});
  });
});
