import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {render, waitFor, fireEvent} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert, Linking} from 'react-native';
import {AppNavigator} from '../../src/navigation/AppNavigator';
import {GlobalLoaderProvider} from '../../src/context/GlobalLoaderContext';
import {useAuth} from '../../src/features/auth/context/AuthContext';
import {useEmergency} from '../../src/features/home/context/EmergencyContext';
import * as CoParentActions from '../../src/features/coParent';
import * as SessionManager from '../../src/features/auth/sessionManager';
import * as LinkedBusinessActions from '../../src/features/linkedBusinesses';

const mockAuthNavigatorRenderSpy = jest.fn();
const mockEmergencySheetOpen = jest.fn();
const mockEmergencySheetClose = jest.fn();
const mockCoParentSheetOpen = jest.fn();
const mockCoParentSheetClose = jest.fn();
let mockRenderNetworkSheetWithRef = true;

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
let mockLinkedHospitals: any[] = [];

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
    if (typeof selector === 'function') {
      return selector({
        theme: {theme: 'light', isDark: false},
        coParent: {pendingInvites: mockPendingInvites},
      });
    }
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
  AuthNavigator: (props: any) => {
    const {View, Text} = require('react-native');
    mockAuthNavigatorRenderSpy(props);
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
        open: mockEmergencySheetOpen,
        close: mockEmergencySheetClose,
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
        open: mockCoParentSheetOpen,
        close: mockCoParentSheetClose,
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

jest.mock('../../src/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(),
  selectLinkedHospitalsForCompanion: jest.fn(() => mockLinkedHospitals),
}));

jest.mock('../../src/features/companion', () => ({
  fetchCompanions: jest.fn(),
  selectSelectedCompanionId: jest.fn(),
}));

jest.mock(
  '../../src/features/network/components/NetworkStatusBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {View} = require('react-native');
    return React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () =>
        mockRenderNetworkSheetWithRef
          ? {
              open: jest.fn(),
              close: jest.fn(),
            }
          : null,
      );
      return <View testID="NetworkStatusBottomSheet" />;
    });
  },
);

jest.mock('../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
  isTokenExpired: jest.fn(),
}));

// --- TEST SUITE ---

describe('AppNavigator', () => {
  const setEmergencySheetRefMock = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const openUrlSpy = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(true as any);
  const consoleWarnSpy = jest
    .spyOn(console, 'warn')
    .mockImplementation(() => {});
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockPendingInvites = []; // Reset store state mock
    mockLinkedHospitals = [];
    mockRenderNetworkSheetWithRef = true;
    mockDispatch.mockImplementation(action => action);

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

  afterAll(() => {
    alertSpy.mockRestore();
    openUrlSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
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
      const tree = renderResult.toJSON();
      expect(tree).toBeTruthy();
      // Check that Modal is rendered for loading state
      expect(tree.type).toBe('Modal');
    });

    it('displays Loading component while checking onboarding status', () => {
      // Simulate async storage taking time
      (AsyncStorage.getItem as jest.Mock).mockReturnValue(
        new Promise(() => {}),
      );
      const renderResult = renderNavigator();
      const tree = renderResult.toJSON();
      expect(tree).toBeTruthy();
      // Check that Modal is rendered for loading state
      expect(tree.type).toBe('Modal');
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

    it('continues past onboarding if saving completion status fails', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('write failed'),
      );

      const {getByText, getByTestId} = renderNavigator();

      await waitFor(() =>
        expect(getByText('Complete Onboarding')).toBeTruthy(),
      );

      fireEvent.press(getByText('Complete Onboarding'));

      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
      expect(errorSpy).toHaveBeenCalledWith(
        'Error saving onboarding status:',
        expect.any(Error),
      );
      errorSpy.mockRestore();
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
      expect(mockAuthNavigatorRenderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          initialRouteName: 'CreateAccount',
          createAccountInitialParams: expect.objectContaining({
            ...mockPayload,
            showOtpSuccess: false,
          }),
        }),
      );
    });

    it('falls back cleanly when the pending profile payload is invalid json', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(key => {
        if (key === '@onboarding_completed') return Promise.resolve('true');
        if (key === '@pending_profile_payload')
          return Promise.resolve('{bad json');
        return Promise.resolve(null);
      });

      const {getByTestId} = renderNavigator();

      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load pending profile payload',
        expect.anything(),
      );
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

    it('logs and skips if seeding the pending profile throws', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', email: 'broken@test.com', parentId: null},
      });
      (SessionManager.getFreshStoredTokens as jest.Mock).mockRejectedValue(
        new Error('token read failed'),
      );

      renderNavigator();

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[AppNavigator] Failed to seed pending profile for incomplete account',
          expect.any(Error),
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

    it('uses the fallback auth branch when logged in without a user object', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: undefined,
      });

      const {getByTestId} = renderNavigator();

      await waitFor(() => expect(getByTestId('AuthNavigator')).toBeTruthy());
      expect(mockAuthNavigatorRenderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          initialRouteName: 'SignUp',
          createAccountInitialParams: undefined,
        }),
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

    it('EmergencySheet: shows alert when no hospital is linked', async () => {
      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Hospital not linked',
        'Link a hospital to quickly call your vet.',
      );
    });

    it('EmergencySheet: shows unavailable alert when linked hospital phone is invalid', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          phone: '() -',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Contact unavailable',
          'The hospital phone number seems invalid. Please update it and try again.',
        );
      });
    });

    it('EmergencySheet: prefers the most recently updated hospital when multiple are linked', async () => {
      mockLinkedHospitals = [
        {
          id: 'older-created',
          phone: '+1 555 000 0001',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'fallback-zero',
          phone: '+1 555 000 0002',
        },
        {
          id: 'newest-updated',
          phone: '+1 555 000 0003',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ];

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(openUrlSpy).toHaveBeenCalledWith('tel:+15550000003');
      });
    });

    it('EmergencySheet: falls back to manual call instructions if both dialers fail', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          phone: '+1 (555) 111-2222',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      openUrlSpy
        .mockRejectedValueOnce(new Error('tel failed'))
        .mockRejectedValueOnce(new Error('telprompt failed'));

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Dialer unavailable',
          'Please call this number manually: +15551112222',
        );
      });
    });

    it('EmergencySheet: fetches hospital details when phone is missing', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          placeId: 'place-123',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      (LinkedBusinessActions.fetchBusinessDetails as jest.Mock).mockReturnValue(
        {
          type: 'linkedBusinesses/fetchBusinessDetails',
        },
      );
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({phoneNumber: '+1 555 333 4444'}),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalledWith(
          'place-123',
        );
        expect(openUrlSpy).toHaveBeenCalledWith('tel:+15553334444');
      });
    });

    it('EmergencySheet: shows unavailable alert when fetched hospital details have no phone number', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          placeId: 'place-456',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      (LinkedBusinessActions.fetchBusinessDetails as jest.Mock).mockReturnValue(
        {
          type: 'linkedBusinesses/fetchBusinessDetails',
        },
      );
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({phoneNumber: '   '}),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Contact unavailable',
          'We could not find a phone number for your linked hospital.',
        );
      });
    });

    it('EmergencySheet: falls back when business details lookup fails', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          organisation: {googlePlacesId: 'org-place-1'},
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      (LinkedBusinessActions.fetchBusinessDetails as jest.Mock).mockReturnValue(
        {
          type: 'linkedBusinesses/fetchBusinessDetails',
        },
      );
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('lookup failed')),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalledWith(
          'org-place-1',
        );
        expect(alertSpy).toHaveBeenCalledWith(
          'Contact unavailable',
          'We could not find a phone number for your linked hospital.',
        );
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[AppNavigator] Failed to fetch hospital phone',
        expect.any(Error),
      );
    });

    it('EmergencySheet: shows unavailable alert when no place id can be resolved', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          phone: '   ',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Contact unavailable',
          'We could not find a phone number for your linked hospital.',
        );
      });
      expect(LinkedBusinessActions.fetchBusinessDetails).not.toHaveBeenCalled();
    });

    it('EmergencySheet: treats missing fetched phone fields as unavailable', async () => {
      mockLinkedHospitals = [
        {
          id: 'h1',
          googlePlacesId: 'legacy-place-1',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];
      (LinkedBusinessActions.fetchBusinessDetails as jest.Mock).mockReturnValue(
        {
          type: 'linkedBusinesses/fetchBusinessDetails',
        },
      );
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({}),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Call Vet')).toBeTruthy());
      fireEvent.press(getByText('Call Vet'));

      await waitFor(() => {
        expect(LinkedBusinessActions.fetchBusinessDetails).toHaveBeenCalledWith(
          'legacy-place-1',
        );
        expect(alertSpy).toHaveBeenCalledWith(
          'Contact unavailable',
          'We could not find a phone number for your linked hospital.',
        );
      });
    });

    it('EmergencySheet: catches navigation failures when reporting an adverse event', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockNavigate.mockImplementationOnce(() => {
        throw new Error('navigation failed');
      });

      const {getByText} = renderNavigator();

      await waitFor(() =>
        expect(getByText('Report Adverse Event')).toBeTruthy(),
      );
      fireEvent.press(getByText('Report Adverse Event'));

      expect(errorSpy).toHaveBeenCalledWith(
        '[AppNavigator] Navigation error:',
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it('CoParentInviteSheet: fetches pending invites on mount', async () => {
      renderNavigator();
      await waitFor(() => {
        expect(CoParentActions.fetchPendingInvites).toHaveBeenCalled();
      });
    });

    it('CoParentInviteSheet: closes immediately when the profile is incomplete', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: null, profileCompleted: false},
      });

      renderNavigator();

      await waitFor(() => {
        expect(mockCoParentSheetClose).toHaveBeenCalled();
        expect(CoParentActions.fetchPendingInvites).not.toHaveBeenCalled();
      });
    });

    it('CoParentInviteSheet: opens for invites and closes again when they clear', async () => {
      mockPendingInvites = [{token: 'inv-open', inviteeName: 'First Invite'}];

      const view = renderNavigator();

      await waitFor(() => expect(mockCoParentSheetOpen).toHaveBeenCalled());

      mockPendingInvites = [];
      view.rerender(
        <NavigationContainer>
          <GlobalLoaderProvider>
            <AppNavigator />
          </GlobalLoaderProvider>
        </NavigationContainer>,
      );

      await waitFor(() => expect(mockCoParentSheetClose).toHaveBeenCalled());
    });

    it('CoParentInviteSheet: resets an out-of-range invite index when invites shrink', async () => {
      mockPendingInvites = [
        {token: 'inv-a', inviteeName: 'Invite A'},
        {token: 'inv-b', inviteeName: 'Invite B'},
      ];
      (CoParentActions.declineCoParentInvite as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue(true),
      });

      const view = renderNavigator();

      await waitFor(() =>
        expect(view.getByText('Decline Invite')).toBeTruthy(),
      );
      fireEvent.press(view.getByText('Decline Invite'));

      await waitFor(() => {
        expect(CoParentActions.declineCoParentInvite).toHaveBeenCalledWith({
          token: 'inv-a',
        });
      });

      mockPendingInvites = [{token: 'inv-b', inviteeName: 'Invite B'}];
      view.rerender(
        <NavigationContainer>
          <GlobalLoaderProvider>
            <AppNavigator />
          </GlobalLoaderProvider>
        </NavigationContainer>,
      );

      await waitFor(() => expect(view.getByText('Invite B')).toBeTruthy());
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

      await waitFor(() => {
        expect(CoParentActions.acceptCoParentInvite).toHaveBeenCalledWith({
          token: 'inv-1',
        });
        expect(CoParentActions.fetchParentAccess).toHaveBeenCalledWith({
          parentId: 'p1',
          companionIds: ['c1'],
        });
      });
    });

    it('CoParentInviteSheet: accepts invites without parent access refresh when parentId is missing', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        isLoggedIn: true,
        user: {id: 'u1', parentId: null, profileCompleted: true},
      });
      mockPendingInvites = [{token: 'inv-1b', inviteeName: 'Invitee Name'}];
      (CoParentActions.acceptCoParentInvite as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue(true),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Accept Invite')).toBeTruthy());
      fireEvent.press(getByText('Accept Invite'));

      await waitFor(() => {
        expect(CoParentActions.acceptCoParentInvite).toHaveBeenCalledWith({
          token: 'inv-1b',
        });
      });
      expect(CoParentActions.fetchParentAccess).not.toHaveBeenCalled();
    });

    it('CoParentInviteSheet: accepts invites without companion ids when the invite has no companion', async () => {
      mockPendingInvites = [{token: 'inv-1c', inviteeName: 'Invitee Name'}];
      (CoParentActions.acceptCoParentInvite as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue(true),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Accept Invite')).toBeTruthy());
      fireEvent.press(getByText('Accept Invite'));

      await waitFor(() => {
        expect(CoParentActions.fetchParentAccess).toHaveBeenCalledWith({
          parentId: 'p1',
          companionIds: undefined,
        });
      });
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

    it('CoParentInviteSheet: shows alert when accepting an invite fails', async () => {
      mockPendingInvites = [
        {token: 'inv-3', inviteeName: 'Invitee Name', companion: {id: 'c1'}},
      ];
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('accept failed')),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Accept Invite')).toBeTruthy());
      fireEvent.press(getByText('Accept Invite'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          'Failed to accept invite',
        );
      });
    });

    it('CoParentInviteSheet: shows alert when declining an invite fails', async () => {
      mockPendingInvites = [{token: 'inv-4', inviteeName: 'Invitee Name'}];
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('decline failed')),
      });

      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Decline Invite')).toBeTruthy());
      fireEvent.press(getByText('Decline Invite'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Error',
          'Failed to decline invite',
        );
      });
    });

    it('CoParentInviteSheet: does nothing when accept is pressed without an active invite', async () => {
      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Accept Invite')).toBeTruthy());
      fireEvent.press(getByText('Accept Invite'));

      await waitFor(() => {
        expect(CoParentActions.acceptCoParentInvite).not.toHaveBeenCalled();
      });
    });

    it('CoParentInviteSheet: does nothing when decline is pressed without an active invite', async () => {
      const {getByText} = renderNavigator();

      await waitFor(() => expect(getByText('Decline Invite')).toBeTruthy());
      fireEvent.press(getByText('Decline Invite'));

      await waitFor(() => {
        expect(CoParentActions.declineCoParentInvite).not.toHaveBeenCalled();
      });
    });

    it('NetworkStatusSheet: skips wiring the ref when the sheet exposes no imperative handle', async () => {
      mockRenderNetworkSheetWithRef = false;

      const {getByTestId} = renderNavigator();

      await waitFor(() =>
        expect(getByTestId('NetworkStatusBottomSheet')).toBeTruthy(),
      );
    });
  });
});
