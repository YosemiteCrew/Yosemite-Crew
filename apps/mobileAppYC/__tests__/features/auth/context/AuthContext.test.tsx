import React from 'react';
import {Text} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {render, act, screen, fireEvent} from '@testing-library/react-native';
import {AuthProvider, useAuth} from '@/features/auth/context/AuthContext';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

const mockDispatch = jest.fn();
let mockState: any = {};

(useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
(useSelector as unknown as jest.Mock).mockImplementation((callback: any) =>
  callback(mockState),
);

const mockEstablishSession = jest.fn();
const mockInitializeAuth = jest.fn();
const mockLogout = jest.fn();
const mockRefreshSession = jest.fn();
const mockUpdateUserProfile = jest.fn();

jest.mock('@/features/auth', () => ({
  establishSession: (...args: any[]) => mockEstablishSession(...args),
  initializeAuth: (...args: any[]) => mockInitializeAuth(...args),
  logout: (...args: any[]) => mockLogout(...args),
  refreshSession: (...args: any[]) => mockRefreshSession(...args),
  updateUserProfile: (...args: any[]) => mockUpdateUserProfile(...args),
  selectAuthState: (state: any) => state.auth,
}));

let mockDevMockSession = false;
const mockSeedDevSession = jest.fn();

jest.mock('@/config/devSession', () => ({
  get DEV_MOCK_SESSION() {
    return mockDevMockSession;
  },
  seedDevSession: (...args: any[]) => mockSeedDevSession(...args),
}));

const resolvedAction = () => {
  const action: any = {type: 'mock-action'};
  action.unwrap = jest.fn(() => Promise.resolve());
  return action;
};

const AuthConsumer = () => {
  const auth = useAuth();
  return (
    <>
      <Text testID="is-logged-in">{String(auth.isLoggedIn)}</Text>
      <Text testID="is-loading">{String(auth.isLoading)}</Text>
      <Text testID="user-id">{auth.user?.id ?? 'none'}</Text>
      <Text testID="provider">{auth.provider ?? 'none'}</Text>
    </>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    mockDevMockSession = false;

    mockInitializeAuth.mockImplementation(() => resolvedAction());
    mockEstablishSession.mockImplementation(() => resolvedAction());
    mockLogout.mockImplementation(() => resolvedAction());
    mockRefreshSession.mockImplementation(() => resolvedAction());
    mockUpdateUserProfile.mockImplementation(() => resolvedAction());

    mockDispatch.mockImplementation((action: any) => action);

    mockState = {
      auth: {
        status: 'idle',
        user: null,
        initialized: false,
        provider: null,
      },
    };
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('throws when useAuth is used outside of an AuthProvider', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<AuthConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider',
    );

    consoleErrorSpy.mockRestore();
  });

  it('seeds a dev mock session and skips initializeAuth when DEV_MOCK_SESSION is enabled', () => {
    mockDevMockSession = true;

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(mockSeedDevSession).toHaveBeenCalledWith(mockDispatch);
    expect(mockInitializeAuth).not.toHaveBeenCalled();
  });

  it('dispatches initializeAuth on mount', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(mockInitializeAuth).toHaveBeenCalledWith({force: true});
  });

  it('reports isLoggedIn false and isLoading true while idle and not initialized', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-logged-in').props.children).toBe('false');
    expect(screen.getByTestId('is-loading').props.children).toBe('true');
  });

  it('reports isLoading true while status is initializing', () => {
    mockState.auth = {
      status: 'initializing',
      user: null,
      initialized: true,
      provider: null,
    };

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-loading').props.children).toBe('true');
  });

  it('reports isLoggedIn true and isLoading false once authenticated with a user', () => {
    mockState.auth = {
      status: 'authenticated',
      user: {id: 'u1', email: 'a@b.com'},
      initialized: true,
      provider: 'google',
    };

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-logged-in').props.children).toBe('true');
    expect(screen.getByTestId('is-loading').props.children).toBe('false');
    expect(screen.getByTestId('user-id').props.children).toBe('u1');
    expect(screen.getByTestId('provider').props.children).toBe('google');
  });

  it('reports isLoggedIn false when status is authenticated but user is missing', () => {
    mockState.auth = {
      status: 'authenticated',
      user: null,
      initialized: true,
      provider: null,
    };

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-logged-in').props.children).toBe('false');
  });

  it('reports isLoading false once idle and initialized', () => {
    mockState.auth = {
      status: 'idle',
      user: null,
      initialized: true,
      provider: null,
    };

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('is-loading').props.children).toBe('false');
  });

  it('login dispatches establishSession with user and tokens', async () => {
    const Consumer = () => {
      const auth = useAuth();
      return (
        <Text
          testID="login-trigger"
          onPress={() =>
            auth.login({id: 'u1'} as any, {accessToken: 'tok'} as any)
          }>
          login
        </Text>
      );
    };

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('login-trigger'));
    });

    expect(mockEstablishSession).toHaveBeenCalledWith({
      user: {id: 'u1'},
      tokens: {accessToken: 'tok'},
    });
  });

  it('logout dispatches the logout thunk', async () => {
    const Consumer = () => {
      const auth = useAuth();
      return (
        <Text testID="logout-trigger" onPress={() => auth.logout()}>
          logout
        </Text>
      );
    };

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('logout-trigger'));
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('updateUser dispatches updateUserProfile with the given updates', async () => {
    const Consumer = () => {
      const auth = useAuth();
      return (
        <Text
          testID="update-trigger"
          onPress={() => auth.updateUser({firstName: 'New'})}>
          update
        </Text>
      );
    };

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('update-trigger'));
    });

    expect(mockUpdateUserProfile).toHaveBeenCalledWith({firstName: 'New'});
  });

  it('refreshSession dispatches the refreshSession thunk', async () => {
    const Consumer = () => {
      const auth = useAuth();
      return (
        <Text testID="refresh-trigger" onPress={() => auth.refreshSession()}>
          refresh
        </Text>
      );
    };

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('refresh-trigger'));
    });

    expect(mockRefreshSession).toHaveBeenCalled();
  });
});
