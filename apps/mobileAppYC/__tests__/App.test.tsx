/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import SuperTokens from 'supertokens-react-native';

jest.mock('@aws-amplify/react-native', () => ({}), {virtual: true});

jest.mock('@react-native-masked-view/masked-view', () => ({
  __esModule: true,
  default: 'MaskedView',
}));

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

jest.mock('@/shared/services/mobileConfig', () => {
  const actual = jest.requireActual('@/shared/services/mobileConfig');
  return {
    ...actual,
    fetchMobileConfig: jest.fn().mockResolvedValue({
      env: 'production',
      enablePayments: false,
    }),
  };
});

// SuperTokens.init runs at module scope in App.tsx (globally mocked in jest.setup)
const mockSuperTokensInit = SuperTokens.init as jest.Mock;

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

test('initializes SuperTokens against the FDI base path on startup', () => {
  expect(mockSuperTokensInit).toHaveBeenCalledTimes(1);
  const configArg = mockSuperTokensInit.mock.calls[0][0] as any;
  expect(configArg).toMatchObject({
    apiBasePath: '/auth',
    tokenTransferMethod: 'header',
  });
  expect(typeof configArg.apiDomain).toBe('string');
  expect(configArg.apiDomain.length).toBeGreaterThan(0);
});

test('selects the API domain matching the runtime environment', () => {
  const {
    MOBILE_CONFIG_BEHAVIOR,
    DEVELOPMENT_API_BASE_URL,
    PRODUCTION_API_BASE_URL,
  } = require('@/config/variables');
  const configArg = mockSuperTokensInit.mock.calls[0][0] as any;

  const expectedDomain =
    MOBILE_CONFIG_BEHAVIOR.overrides?.apiBaseUrl ??
    (MOBILE_CONFIG_BEHAVIOR.useDevApi
      ? DEVELOPMENT_API_BASE_URL
      : PRODUCTION_API_BASE_URL);
  expect(configArg.apiDomain).toBe(expectedDomain);
});

describe('review login flag resolution', () => {
  const {fetchMobileConfig} = require('@/shared/services/mobileConfig');
  const {AUTH_FEATURE_FLAGS} = require('@/config/variables');

  const renderApp = async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | undefined;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(async () => {});
    await ReactTestRenderer.act(async () => {
      tree?.unmount();
    });
  };

  afterEach(() => {
    AUTH_FEATURE_FLAGS.enableReviewLogin = false;
  });

  it('forces review login off in a production env even when config enables it', async () => {
    AUTH_FEATURE_FLAGS.enableReviewLogin = true;
    (fetchMobileConfig as jest.Mock).mockResolvedValueOnce({
      env: 'production',
      enablePayments: false,
      enableReviewLogin: true,
    });

    await renderApp();

    expect(AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(false);
  });

  it('forces review login off in a production env when config omits the flag', async () => {
    AUTH_FEATURE_FLAGS.enableReviewLogin = true;
    (fetchMobileConfig as jest.Mock).mockResolvedValueOnce({
      env: 'prod',
      enablePayments: false,
    });

    await renderApp();

    expect(AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(false);
  });

  it('honors the config flag outside a production env', async () => {
    (fetchMobileConfig as jest.Mock).mockResolvedValueOnce({
      env: 'staging',
      enablePayments: false,
      enableReviewLogin: true,
    });

    await renderApp();

    expect(AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(true);
  });

  it('disables review login outside a production env when config turns it off', async () => {
    AUTH_FEATURE_FLAGS.enableReviewLogin = true;
    (fetchMobileConfig as jest.Mock).mockResolvedValueOnce({
      env: 'dev',
      enablePayments: false,
      enableReviewLogin: false,
    });

    await renderApp();

    expect(AUTH_FEATURE_FLAGS.enableReviewLogin).toBe(false);
  });
});
