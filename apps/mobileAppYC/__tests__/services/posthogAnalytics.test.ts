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

// Mutable config — prefix with "mock" to satisfy Jest's factory scope check.
// Modify before requiring the module (module cache is cleared in beforeEach).
let mockEnabled = true;
let mockApiKey = 'phc_test_key';
let mockHost = 'https://eu.i.posthog.com';
let mockCaptureScreens = true;

jest.mock('@/config/variables', () => ({
  get POSTHOG_CONFIG() {
    return {
      apiKey: mockApiKey,
      captureScreens: mockCaptureScreens,
      defaultOptIn: false,
      enableSessionReplay: false,
      enabled: mockEnabled,
      host: mockHost,
    };
  },
}));

describe('posthogAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockEnabled = true;
    mockApiKey = 'phc_test_key';
    mockHost = 'https://eu.i.posthog.com';
    mockCaptureScreens = true;
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
        host: 'https://eu.i.posthog.com',
        persistence: 'file',
      }),
    );
  });

  it('returns existing client on subsequent initializePostHog calls (singleton)', () => {
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');
    const MockedPostHog = require('posthog-react-native');

    const first = initializePostHog();
    const second = initializePostHog();

    expect(first).toBe(second);
    expect(MockedPostHog).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not initialize when enabled is false', () => {
    mockEnabled = false;
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');
    const MockedPostHog = require('posthog-react-native');

    const result = initializePostHog();

    expect(result).toBeNull();
    expect(MockedPostHog).not.toHaveBeenCalled();
  });

  it('returns null and warns when apiKey is blank', () => {
    mockApiKey = '   ';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');

    const result = initializePostHog();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PostHog] Missing apiKey or host; SDK initialization skipped.',
    );
    warnSpy.mockRestore();
  });

  it('returns null and warns when host is blank', () => {
    mockHost = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');

    const result = initializePostHog();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('only emits the missing-config warning once across multiple calls', () => {
    mockApiKey = '';
    mockHost = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {
      initializePostHog,
    } = require('../../src/shared/services/posthogAnalytics');

    initializePostHog();
    initializePostHog();
    initializePostHog();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('tracks screen views through PostHog', async () => {
    const {
      trackPostHogScreen,
    } = require('../../src/shared/services/posthogAnalytics');

    await trackPostHogScreen('Dashboard');

    expect(mockScreen).toHaveBeenCalledWith('Dashboard');
  });

  it('skips screen tracking when captureScreens is false', async () => {
    mockCaptureScreens = false;
    const {
      trackPostHogScreen,
    } = require('../../src/shared/services/posthogAnalytics');

    await trackPostHogScreen('Dashboard');

    expect(mockScreen).not.toHaveBeenCalled();
  });

  it('skips screen tracking when PostHog is disabled (client is null)', async () => {
    mockEnabled = false;
    const {
      trackPostHogScreen,
    } = require('../../src/shared/services/posthogAnalytics');

    await trackPostHogScreen('Dashboard');

    expect(mockScreen).not.toHaveBeenCalled();
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

  it('setPostHogTrackingEnabled does nothing when client is null', async () => {
    mockEnabled = false;
    const {
      setPostHogTrackingEnabled,
    } = require('../../src/shared/services/posthogAnalytics');

    await setPostHogTrackingEnabled(true);
    await setPostHogTrackingEnabled(false);

    expect(mockOptIn).not.toHaveBeenCalled();
    expect(mockOptOut).not.toHaveBeenCalled();
  });

  it('resetPostHog calls reset on the client when initialized', () => {
    const {
      initializePostHog,
      resetPostHog,
    } = require('../../src/shared/services/posthogAnalytics');

    initializePostHog();
    resetPostHog();

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('resetPostHog is a no-op when client was never initialized', () => {
    mockEnabled = false;
    const {
      resetPostHog,
    } = require('../../src/shared/services/posthogAnalytics');

    expect(() => resetPostHog()).not.toThrow();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('getPostHogClient initializes and returns the client', () => {
    const {
      getPostHogClient,
    } = require('../../src/shared/services/posthogAnalytics');
    const MockedPostHog = require('posthog-react-native');

    const client = getPostHogClient();

    expect(client).not.toBeNull();
    expect(MockedPostHog).toHaveBeenCalledTimes(1);
  });
});
