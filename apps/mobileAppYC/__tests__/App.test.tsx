/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@stripe/stripe-react-native', () => ({
  StripeProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
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
    NavigationContainer: ({children}: {children: React.ReactNode}) => <>{children}</>,
    useNavigationContainerRef: jest.fn(() => ({
      current: null,
      isReady: () => true,
      navigate: jest.fn(),
      resetRoot: jest.fn(),
    })),
    useDocumentTitle: jest.fn(),
  };
});

jest.mock('../src/navigation', () => ({
  AppNavigator: () => null,
}));

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
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
