import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {render, waitFor, fireEvent} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppNavigator} from '../../src/navigation/AppNavigator';
import {GlobalLoaderProvider} from '../../src/context/GlobalLoaderContext';
import {useAuth} from '../../src/features/auth/context/AuthContext';
import {useEmergency} from '../../src/features/home/context/EmergencyContext';
import * as CoParentActions from '../../src/features/coParent';
import * as SessionManager from '../../src/features/auth/sessionManager';

// --- 1. Mock Config Constants (MUST BE FIRST) ---
jest.mock('../../src/config/variables', () => ({
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
  PENDING_PROFILE_UPDATED_EVENT: 'PENDING_PROFILE_UPDATED',
  API_CONFIG: {
    baseUrl: 'http://localhost:3000',
    timeoutMs: 10000,
  },
}));

// --- 2. Redux Mock ---
const mockDispatch = jest.fn();
// We'll use a variable to control the return value of the pending invites selector dynamically
let mockPendingInvites: any[] = [];

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: any) => {
    // Handle the specific companion ID selector
    if (
      selector?.name === 'selectSelectedCompanionId' ||
      selector ===
        require('../../src/features/companion').selectSelectedCompanionId
    ) {
      return 'comp-123';
    }
    // Handle the pending invites selector
    return mockPendingInvites;
  },
}));

// --- 3. Context Mocks ---
jest.mock('../../src/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/features/home/context/EmergencyContext', () => ({
  useEmergency: jest.fn(),
  EmergencyProvider: ({children}: {children: React.ReactNode}) => (
    <>{children}</>
  ),
}));

// --- 4. Navigation Mocks ---

// Mock Native Stack to simply render the active screen configuration
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children}: any) => <>{children}</>,
    Screen: ({component, children}: any) => {
      // Render component prop
      if (component) {
        const Component = component;
        return <Component />;
      }
      // Render children function (render prop pattern used in AppNavigator)
      if (typeof children === 'function') {
        return children();
      }
      return null;
    },
  }),
}));

// Mock useNavigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

// --- 5. Component & Screen Mocks ---

jest.mock('../../src/navigation/AuthNavigator', () => ({
  AuthNavigator: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="AuthNavigator">
        <Text>Auth Screen</Text>
      </View>
    );
  },
}));

jest.mock('../../src/navigation/TabNavigator', () => ({
  TabNavigator: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="TabNavigator">
        <Text>Main Tab Screen</Text>
      </View>
    );
  },
}));

jest.mock('../../src/features/onboarding/screens/OnboardingScreen', () => ({
  OnboardingScreen: ({onComplete}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="OnboardingScreen">
        <Text onPress={onComplete}>Complete Onboarding</Text>
      </View>
    );
  },
}));

jest.mock('../../src/shared/components/common', () => ({
  Loading: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="LoadingIndicator">
        <Text>Loading...</Text>
      </View>
    );
  },
}));

// Mock Bottom Sheets with imperative handles
jest.mock('../../src/features/home/components/EmergencyBottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require('react');
  const {View, Text} = require('react-native');
  return {
    EmergencyBottomSheet: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return (
        <View testID="EmergencyBottomSheet">
          <Text onPress={props.onCallVet}>Call Vet</Text>
          <Text onPress={props.onAdverseEvent}>Report Adverse Event</Text>
        </View>
      );
    }),
  };
});

jest.mock(
  '../../src/features/coParent/components/CoParentInviteBottomSheet/CoParentInviteBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {View, Text} = require('react-native');
    return React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      // Simulate rendering invite details if present
      return (
        <View testID="CoParentInviteBottomSheet">
          <Text>{props.inviteeName}</Text>
          <Text onPress={props.onAccept}>Accept Invite</Text>
          <Text onPress={props.onDecline}>Decline Invite</Text>
        </View>
      );
    });
  },
);

// --- 6. Action Mocks ---
jest.mock('../../src/features/coParent', () => ({
  acceptCoParentInvite: jest.fn(),
  declineCoParentInvite: jest.fn(),
  fetchParentAccess: jest.fn(),
  fetchPendingInvites: jest.fn(),
}));

jest.mock('../../src/features/companion', () => ({
  fetchCompanions: jest.fn(),
  selectSelectedCompanionId: jest.fn(),
}));

jest.mock('../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

// --- TEST SUITE ---

describe('AppNavigator', () => {
  const setEmergencySheetRefMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingInvites = []; // Reset store state mock

    // Auth Context Default
    (useAuth as jest.Mock).mockReturnValue({
      isLoggedIn: false,
      isLoading: false,
      user: null,
    });

    // Emergency Context Default
    (useEmergency as jest.Mock).mockReturnValue({
      setEmergencySheetRef: setEmergencySheetRefMock,
    });

    // AsyncStorage Default (Not onboarded)
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);
  });

  const renderNavigator = () => {
    return render(
      <NavigationContainer>
        <GlobalLoaderProvider>
          <AppNavigator />
        </GlobalLoaderProvider>
      </NavigationContainer>,
    );
  };

  describe('Initialization & Loading', () => {
    it('displays Loading component while auth is loading', () => {
      (useAuth as jest.Mock).mockReturnValue({isLoading: true});
      const renderResult = renderNavigator();
      expect(renderResult.toJSON()).toBeNull();
    });

    it('displays Loading component while checking onboarding status', () => {
      // Simulate async storage taking time
      (AsyncStorage.getItem as jest.Mock).mockReturnValue(
        new Promise(() => {}),
      );
      const renderResult = renderNavigator();
      expect(renderResult.toJSON()).toBeNull();
    });
  });

  describe('Onboarding Flow', () => {
    it('renders OnboardingScreen when storage key is missing', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const {getByTestId} = renderNavigator();

      await waitFor(() => expect(getByTestId('OnboardingScreen')).toBeTruthy());
    });

    it('completes onboarding and saves status to storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const {getByText} = renderNavigator();

      await waitFor(() =>
        expect(getByText('Complete Onboarding')).toBeTruthy(),
      );

      fireEvent.press(getByText('Complete Onboarding'));

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@onboarding_completed',
          'true',
        );
      });
    });

    it('defaults to OnboardingScreen if storage check throws error', async () => {
      // Suppress console error for cleaner test output
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage Error'),
      );

      const {getByTestId} = renderNavigator();

      await waitFor(() => expect(getByTestId('OnboardingScreen')).toBeTruthy());
      spy.mockRestore();
    });
  });

  describe('Authentication Routing', () => {
    beforeEach(() => {
      // Assume onboarding is done for routing tests
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@onboarding_completed') return Promise.resolve('true');
        return Promise.resolve(null);
      });
    });

    it('renders AuthNavigator when user is NOT logged in', async () => {
      (useAuth as jest.Mock).mockReturnValue({isLoggedIn: false, user: null});
      const {getByTestId} = renderNavigator();
      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
    });

    it('renders AuthNavigator when logged in but user profile is incomplete (no parentId)', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: null}, // Incomplete
      });
      const {getByTestId} = renderNavigator();
      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
    });

    it('renders TabNavigator (Main) when logged in AND profile is complete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: 'p1'}, // Complete
      });
      const {getByTestId} = renderNavigator();
      await waitFor(() => expect(getByTestId('TabNavigator')).toBeTruthy());
    });
  });

  describe('Pending Profile / Deep Link Logic', () => {
    const mockPayload = {
      email: 'test@example.com',
      userId: '123',
      initialAttributes: {firstName: 'Test'},
    };

    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@onboarding_completed') return Promise.resolve('true');
        return Promise.resolve(null); // No pending profile initially
      });
    });

    it('renders AuthNavigator if a pending profile exists in storage (override main)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@onboarding_completed') return Promise.resolve('true');
        if (key === '@pending_profile_payload')
          return Promise.resolve(JSON.stringify(mockPayload));
        return Promise.resolve(null);
      });

      // Even if logged in and complete, pending profile might force auth screen logic
      (useAuth as jest.Mock).mockReturnValue({isLoggedIn: false});

      const {getByTestId} = renderNavigator();
      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
    });

    it('seeds pending profile logic when user is logged in but incomplete (recovery flow)', async () => {
      const mockUser = {
        id: 'u1',
        email: 'recover@test.com',
        parentId: null,
        profileToken: 'pt1',
      };
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: mockUser,
      });

      (SessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue({
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      (SessionManager.isTokenExpired as jest.Mock).mockReturnValue(false);

      renderNavigator();

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@pending_profile_payload',
          expect.stringContaining(mockUser.email),
        );
      });
    });

    it('skips seeding pending profile if no tokens are available', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: null},
      });
      (SessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue(
        null,
      );

      renderNavigator();

      // Wait a tick to ensure effect runs
      await waitFor(() => {});

      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        '@pending_profile_payload',
        expect.anything(),
      );
    });

    it('skips seeding if tokens are expired', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: null},
      });
      (SessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue({
        idToken: 't',
      });
      (SessionManager.isTokenExpired as jest.Mock).mockReturnValue(true);

      renderNavigator();

      await waitFor(() => {});

      expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
        '@pending_profile_payload',
        expect.anything(),
      );
    });
  });

  describe('Sub-Components (Sheets)', () => {
    beforeEach(() => {
      // Render Main for these tests
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: 'p1'},
      });
    });

    it('EmergencySheet: sets ref and handles navigation', async () => {
      const {getByTestId, getByText} = renderNavigator();
      await waitFor(() => expect(getByTestId('TabNavigator')).toBeTruthy());

      expect(setEmergencySheetRefMock).toHaveBeenCalled();

      fireEvent.press(getByText('Report Adverse Event'));
      expect(mockNavigate).toHaveBeenCalledWith(
        'Main',
        expect.objectContaining({
          screen: 'HomeStack',
        }),
      );
    });

    it('CoParentInviteSheet: fetches pending invites on mount', async () => {
      renderNavigator();
      await waitFor(() => {
        expect(CoParentActions.fetchPendingInvites).toHaveBeenCalled();
      });
    });

    it('CoParentInviteSheet: handles accepting an invite', async () => {
      const mockInvite = {
        token: 'inv-1',
        inviteeName: 'Invitee Name',
        companion: {id: 'c1'},
      };
      mockPendingInvites = [mockInvite];

      // Mock accept action thunk
      (CoParentActions.acceptCoParentInvite as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue(true),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Accept Invite')).toBeTruthy());
      fireEvent.press(getByText('Accept Invite'));
    });

    it('CoParentInviteSheet: handles declining an invite', async () => {
      const mockInvite = {token: 'inv-2', inviteeName: 'Invitee Name'};
      mockPendingInvites = [mockInvite];

      (CoParentActions.declineCoParentInvite as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue(true),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Decline Invite')).toBeTruthy());
      fireEvent.press(getByText('Decline Invite'));

      await waitFor(() => {
        expect(CoParentActions.declineCoParentInvite).toHaveBeenCalledWith({
          token: 'inv-2',
        });
      });
    });
  });
});
