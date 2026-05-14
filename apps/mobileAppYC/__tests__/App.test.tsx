/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Amplify} from 'aws-amplify';

jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
}));

jest.mock('@/shared/services/posthogAnalytics', () => ({
  initializePostHog: jest.fn(),
  trackPostHogScreen: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/shared/services/firebaseNotifications', () => ({
  initializeNotifications: jest.fn().mockResolvedValue(undefined),
  areNotificationsInitialized: jest.fn(() => true),
}));

jest.mock('react-native-device-info', () => ({
  getBundleId: jest.fn(() => 'com.yosemite.app'),
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({children}: {children: React.ReactNode}) => (
      <>{children}</>
    ),
    useNavigationContainerRef: jest.fn(() => ({
      current: null,
      isReady: () => true,
      navigate: jest.fn(),
      resetRoot: jest.fn(),
      getCurrentRoute: jest.fn(() => ({name: 'Home'})),
    })),
    useDocumentTitle: jest.fn(),
  };
});

jest.mock('../src/navigation', () => ({
  AppNavigator: () => null,
}));

// Spy must be set up before App module is required (module-level Amplify.configure call)
const mockAmplifyConfigure = jest
  .spyOn(Amplify, 'configure')
  .mockImplementation(() => {});

const App = require('../App').default;

const originalDocument = (globalThis as any).document;

beforeAll(() => {
  if (!(globalThis as any).document) {
    (globalThis as any).document = {title: ''};
  }
});

afterAll(() => {
  if (originalDocument) {
    (globalThis as any).document = originalDocument;
  } else {
    delete (globalThis as any).document;
  }
  mockAmplifyConfigure.mockRestore();
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('configures Amplify with an auth pool on startup', () => {
  expect(mockAmplifyConfigure).toHaveBeenCalledTimes(1);
  const configArg = mockAmplifyConfigure.mock.calls[0][0] as any;
  expect(configArg).toHaveProperty('auth.user_pool_id');
  expect(configArg).toHaveProperty('auth.user_pool_client_id');
  expect(configArg).toHaveProperty('auth.identity_pool_id');
});

test('selects dev pool when useDevApi is true', () => {
  const devOutputs = require('../devamplify_outputs.json');
  const prodOutputs = require('../prodamplify_outputs.json');
  const {MOBILE_CONFIG_BEHAVIOR} = require('@/config/variables');
  const configArg = mockAmplifyConfigure.mock.calls[0][0];

  if (MOBILE_CONFIG_BEHAVIOR.useDevApi) {
    expect(configArg).toEqual(devOutputs);
  } else {
    expect(configArg).toEqual(prodOutputs);
  }
});
