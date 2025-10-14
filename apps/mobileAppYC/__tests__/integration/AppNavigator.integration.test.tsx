import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Provider} from 'react-redux';

import {store} from '@/app/store';

import {AppNavigator} from '@/navigation/AppNavigator';
import {useAuth} from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';
import {PENDING_PROFILE_STORAGE_KEY} from '@/config/variables';

jest.mock('@react-navigation/native-stack', () => {
  require('react');
  return {
    createNativeStackNavigator: () => {
      const Navigator = ({children}: any) => <>{children}</>;
      const Screen = ({children, component: Component, ...rest}: any) => {
        if (Component) {
          return <Component {...rest} />;
        }
        if (typeof children === 'function') {
          return children(rest);
        }
        return children ?? null;
      };
      return {Navigator, Screen};
    },
  };
});

const mockAuthNavigator = jest.fn();
const mockTabNavigator = jest.fn();
const mockOnboardingScreen = jest.fn();
jest.mock('@/navigation/AuthNavigator', () => {
  require('react');
  const {Text: MockText} = require('react-native');

  return {
    AuthNavigator: (props: any) => {
      const {initialRouteName} = props;
      mockAuthNavigator(props);
      return (
        <MockText testID="auth-navigator">
          AuthNavigator:{initialRouteName}
        </MockText>
      );
    },
  };
});

jest.mock('@/navigation/TabNavigator', () => {
  require('react');
  const {Text: MockText} = require('react-native');

  return {
    TabNavigator: (props: any) => {
      mockTabNavigator(props);
      return <MockText testID="main-navigator">MainNavigator</MockText>;
    },
  };
});

jest.mock('@/screens/onboarding/OnboardingScreen', () => {
  require('react');
  const {Text: MockText} = require('react-native');

  return {
    OnboardingScreen: (props: {onComplete: () => void}) => {
      mockOnboardingScreen(props);
      return (
        <MockText testID="onboarding-screen" onPress={props.onComplete}>
          OnboardingScreen
        </MockText>
      );
    },
  };
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const createAuthValue = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
  isLoggedIn: false,
  isLoading: false,
  user: null,
  provider: null,
  login: jest.fn(),
  logout: jest.fn(),
  updateUser: jest.fn(),
  refreshSession: jest.fn(),
  ...overrides,
});

const renderNavigator = async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <Provider store={store}>
        <AppNavigator />
      </Provider>,
    );
  });
  await act(async () => {});
  return renderer!;
};

describe('AppNavigator integration', () => {
  let addListenerSpy: jest.SpyInstance;
  let setItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    addListenerSpy = jest
      .spyOn(DeviceEventEmitter, 'addListener')
      .mockReturnValue({remove: jest.fn()} as any);
    setItemSpy = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    addListenerSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('shows onboarding when onboarding has not been completed', async () => {
    mockedUseAuth.mockReturnValue(createAuthValue());
    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
      if (key === '@onboarding_completed') {
        return null;
      }
      if (key === PENDING_PROFILE_STORAGE_KEY) {
        return null;
      }
      return null;
    });

    await renderNavigator();
    expect(mockOnboardingScreen).toHaveBeenCalled();
    expect(mockAuthNavigator).not.toHaveBeenCalled();
    expect(mockTabNavigator).not.toHaveBeenCalled();
    getItemSpy.mockRestore();
  });

  it('renders auth navigator when onboarding completed and user not logged in', async () => {
    mockedUseAuth.mockReturnValue(createAuthValue());
    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
      if (key === '@onboarding_completed') {
        return 'true';
      }
      if (key === PENDING_PROFILE_STORAGE_KEY) {
        return null;
      }
      return null;
    });

    const renderer = await renderNavigator();
    const node = renderer.root.findByProps({testID: 'auth-navigator'});
    expect(Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).toBe(
      'AuthNavigator:SignUp',
    );
    expect(mockAuthNavigator).toHaveBeenCalledWith(
      expect.objectContaining({initialRouteName: 'SignUp'}),
    );
    getItemSpy.mockRestore();
  });

  it('renders main navigator when profile is complete', async () => {
    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isLoggedIn: true,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          profileToken: 'token',
        },
      }),
    );
    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
      if (key === '@onboarding_completed') {
        return 'true';
      }
      if (key === PENDING_PROFILE_STORAGE_KEY) {
        return null;
      }
      return null;
    });

    const renderer = await renderNavigator();
    renderer.root.findByProps({testID: 'main-navigator'});
    expect(mockTabNavigator).toHaveBeenCalled();
    getItemSpy.mockRestore();
  });

  it('prefers create account when pending profile exists', async () => {
    const pendingPayload = {
      userId: 'pending-user',
      email: 'pending@example.com',
      profileToken: 'pending-token',
      tokens: {idToken: 'id', accessToken: 'access', provider: 'amplify'},
      initialAttributes: {},
    };

    mockedUseAuth.mockReturnValue(
      createAuthValue({
        isLoggedIn: true,
        user: {
          id: 'pending-user',
          email: 'pending@example.com',
          firstName: undefined,
          lastName: undefined,
          dateOfBirth: undefined,
          profileToken: undefined,
        },
      }),
    );

    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
      if (key === '@onboarding_completed') {
        return 'true';
      }
      if (key === PENDING_PROFILE_STORAGE_KEY) {
        return JSON.stringify(pendingPayload);
      }
      return null;
    });

    const renderer = await renderNavigator();
    const node = renderer.root.findByProps({testID: 'auth-navigator'});
    expect(Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).toBe(
      'AuthNavigator:CreateAccount',
    );
    expect(mockAuthNavigator).toHaveBeenCalledWith(
      expect.objectContaining({
        initialRouteName: 'CreateAccount',
        createAccountInitialParams: expect.objectContaining({
          userId: 'pending-user',
        }),
      }),
    );
    getItemSpy.mockRestore();
  });
});
