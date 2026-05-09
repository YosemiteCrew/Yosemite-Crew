const mockScreen = jest.fn().mockResolvedValue(undefined);
const mockOptIn = jest.fn().mockResolvedValue(undefined);
const mockOptOut = jest.fn().mockResolvedValue(undefined);
const mockReset = jest.fn();

jest.mock('posthog-react-native', () =>
  jest.fn().mockImplementation(() => ({
    optIn: mockOptIn,
    optOut: mockOptOut,
    reset: mockReset,
    screen: mockScreen,
  })),
);

jest.mock('@/config/variables', () => ({
  POSTHOG_CONFIG: {
    apiKey: 'phc_test_key',
    captureScreens: true,
    defaultOptIn: false,
    enableSessionReplay: false,
    enabled: true,
    host: 'https://us.i.posthog.com',
  },
}));

describe('posthogAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('initializes the PostHog client with secure defaults', () => {
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');
    const MockedPostHog = require('posthog-react-native');

    initializePostHog();

    expect(MockedPostHog).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({
        captureAppLifecycleEvents: true,
        defaultOptIn: false,
        enableSessionReplay: false,
        host: 'https://us.i.posthog.com',
        persistence: 'file',
      }),
    );
  });

  it('tracks screen views through PostHog', async () => {
    const {
      trackPostHogScreen,
    } = require('../../src/shared/services/posthogAnalytics');

    await trackPostHogScreen('Dashboard');

    expect(mockScreen).toHaveBeenCalledWith('Dashboard');
  });

  it('can opt users in and out of tracking', async () => {
    const {
      setPostHogTrackingEnabled,
    } = require('../../src/shared/services/posthogAnalytics');

    await setPostHogTrackingEnabled(true);
    await setPostHogTrackingEnabled(false);

    expect(mockOptIn).toHaveBeenCalledTimes(1);
    expect(mockOptOut).toHaveBeenCalledTimes(1);
  });
});
