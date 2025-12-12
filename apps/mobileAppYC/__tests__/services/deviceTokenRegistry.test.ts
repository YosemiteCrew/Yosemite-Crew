import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import * as sessionManager from '../../src/features/auth/sessionManager';
import {
  isRunningOnIosSimulator,
} from '../../src/shared/services/deviceTokenRegistry';

// --- Mocks ---

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios', // Default, will change in tests
    select: jest.fn(),
  },
}));

// Mock Device Info
jest.mock('react-native-device-info', () => ({
  isEmulator: jest.fn(),
}));

// Mock API Client
jest.mock('../../src/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn((token) => ({Authorization: `Bearer ${token}`})),
}));

// Mock Session Manager
jest.mock('../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));

describe('deviceTokenRegistry', () => {
  const mockUserId = 'user-123';
  const mockToken = 'device-token-abc';
  const mockAccessToken = 'access-token-xyz';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset global module state hacks if necessary.
    // Since 'cachedIsEmulator' and 'lastAccessToken' are module-level variables,
    // they persist between tests. We need to be mindful of this or use jest.resetModules().
    // For simpler testing, we can rely on varying the mock returns.

    // Default mock setup
    (sessionManager.getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
    });
    (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(false);
  });

  // To cleanly reset the internal module cache (cachedIsEmulator, lastAccessToken)
  // we would ideally use jest.resetModules(), but since we are importing specific functions,
  // we will structure tests to handle the stateful nature or just re-require.
  // For this suite, we will assume standard execution flow is sufficient.

  describe('shouldSkipDeviceTokenCalls (Internal Logic)', () => {
    it('returns false immediately if Platform is not iOS (Android)', async () => {
      Platform.OS = 'android';
      // Even if isEmulator returns true, Android should NOT skip
      (DeviceInfo.isEmulator as jest.Mock).mockResolvedValue(true);

      const result = await isRunningOnIosSimulator();
      expect(result).toBe(false);
      // Shouldn't even check emulator status for Android
      // Note: If cachedIsEmulator was set by previous tests, this assertion might differ.
      // But based on code: if (Platform.OS !== 'ios') return false; happens first.
    });

    it('returns true if iOS and isEmulator is true', async () => {
      Platform.OS = 'ios';
      // We need to reset the module to clear 'cachedIsEmulator' if previously set
      jest.resetModules();
      const {isRunningOnIosSimulator: runCheck} = require('../../src/shared/services/deviceTokenRegistry');
      const {isEmulator} = require('react-native-device-info');

      isEmulator.mockResolvedValue(true);

      const result = await runCheck();
      expect(result).toBe(true);
    });

    it('returns false if iOS and isEmulator is false', async () => {
      Platform.OS = 'ios';
      jest.resetModules();
      const {isRunningOnIosSimulator: runCheck} = require('../../src/shared/services/deviceTokenRegistry');
      const {isEmulator} = require('react-native-device-info');

      isEmulator.mockResolvedValue(false);

      const result = await runCheck();
      expect(result).toBe(false);
    });

    it('handles error in isEmulator check and defaults to false (not skipping)', async () => {
      Platform.OS = 'ios';
      jest.resetModules();
      const {isRunningOnIosSimulator: runCheck} = require('../../src/shared/services/deviceTokenRegistry');
      const {isEmulator} = require('react-native-device-info');

      // Spy on console.warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      isEmulator.mockRejectedValue(new Error('Emulator check failed'));

      const result = await runCheck();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DeviceToken] Unable to determine simulator status',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('uses cached value on subsequent calls', async () => {
      Platform.OS = 'ios';
      jest.resetModules();
      const {isRunningOnIosSimulator: runCheck} = require('../../src/shared/services/deviceTokenRegistry');
      const {isEmulator} = require('react-native-device-info');

      isEmulator.mockResolvedValue(true);

      // First call
      await runCheck();
      // Second call
      const result = await runCheck();

      expect(result).toBe(true);
      // isEmulator should only be called once because result is cached
      expect(isEmulator).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerDeviceToken', () => {
    beforeEach(() => {
        // Ensure we are in a clean state regarding the cache for these tests
        jest.resetModules();
        Platform.OS = 'ios'; // Default
        // Re-setup basic mocks since resetModules cleared them
        const {isEmulator} = require('react-native-device-info');
        isEmulator.mockResolvedValue(false); // Default to real device
    });

    it('does nothing if userId or token is missing', async () => {
      const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');

      await register({userId: null, token: mockToken});
      await register({userId: mockUserId, token: null});
      await register({userId: '', token: ''});

      expect(api.post).not.toHaveBeenCalled();
    });

    it('skips execution on iOS Simulator', async () => {
      const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {isEmulator} = require('react-native-device-info');

      isEmulator.mockResolvedValue(true); // Is Simulator
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await register({userId: mockUserId, token: mockToken});

      expect(consoleSpy).toHaveBeenCalledWith('[DeviceToken] Skipping device token register on iOS simulator');
      expect(api.post).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('successfully registers on real device (iOS)', async () => {
      const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

      // Mock tokens
      getTokens.mockResolvedValue({accessToken: 'fresh-token'});

      await register({userId: mockUserId, token: mockToken});

      expect(api.post).toHaveBeenCalledWith(
        '/v1/device-token/register',
        {
          userId: mockUserId,
          deviceToken: mockToken,
          platform: 'ios',
        },
        {headers: {Authorization: 'Bearer fresh-token'}},
      );
    });

    it('successfully registers on Android (skips emulator check logic)', async () => {
        Platform.OS = 'android';
        const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
        const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

        getTokens.mockResolvedValue({accessToken: 'android-token'});

        await register({userId: mockUserId, token: mockToken});
    });

    it('handles API failure gracefully', async () => {
      const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

      getTokens.mockResolvedValue({accessToken: 'token'});
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      api.post.mockRejectedValue(new Error('API Error'));

      await register({userId: mockUserId, token: mockToken});

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DeviceToken] Failed to register device token',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('unregisterDeviceToken', () => {
    beforeEach(() => {
        jest.resetModules();
        Platform.OS = 'ios';
        const {isEmulator} = require('react-native-device-info');
        isEmulator.mockResolvedValue(false);
    });

    it('does nothing if token is missing', async () => {
      const {unregisterDeviceToken: unregister} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');

      await unregister({userId: mockUserId, token: null});
      expect(api.post).not.toHaveBeenCalled();
    });

    it('skips execution on iOS Simulator', async () => {
      const {unregisterDeviceToken: unregister} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {isEmulator} = require('react-native-device-info');

      isEmulator.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await unregister({userId: mockUserId, token: mockToken});

      expect(consoleSpy).toHaveBeenCalledWith('[DeviceToken] Skipping device token unregister on iOS simulator');
      expect(api.post).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('successfully unregisters with headers', async () => {
      const {unregisterDeviceToken: unregister} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

      getTokens.mockResolvedValue({accessToken: 'valid-token'});

      await unregister({userId: mockUserId, token: mockToken});

      expect(api.post).toHaveBeenCalledWith(
        '/v1/device-token/unregister',
        {
          userId: mockUserId,
          deviceToken: mockToken,
          platform: 'ios',
        },
        {headers: {Authorization: 'Bearer valid-token'}},
      );
    });

    it('handles API failure gracefully', async () => {
      const {unregisterDeviceToken: unregister} = require('../../src/shared/services/deviceTokenRegistry');
      const {default: api} = require('../../src/shared/services/apiClient');
      const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

      getTokens.mockResolvedValue({accessToken: 'token'});
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      api.post.mockRejectedValue(new Error('Unregister Fail'));

      await unregister({userId: mockUserId, token: mockToken});

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DeviceToken] Failed to unregister device token',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Auth Header Logic (buildAuthHeaders)', () => {
    // We test this implicitly via register/unregister calls but targeting specific scenarios
    // 1. Fresh tokens available -> updates lastAccessToken
    // 2. Fresh tokens missing -> uses lastAccessToken
    // 3. Both missing -> returns undefined

    beforeEach(() => {
        jest.resetModules();
        Platform.OS = 'ios';
        const {isEmulator} = require('react-native-device-info');
        isEmulator.mockResolvedValue(false);
    });

    it('uses cached lastAccessToken if getFreshStoredTokens returns null', async () => {
        const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
        const {default: api} = require('../../src/shared/services/apiClient');
        const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

        // Step 1: Call successfully to cache the token
        getTokens.mockResolvedValue({accessToken: 'cached-token'});
        await register({userId: '1', token: 't1'});

        // Step 2: Call again where fresh tokens return null
        getTokens.mockResolvedValue(null);
        await register({userId: '2', token: 't2'});

        // Verify the second call still used the cached token
        expect(api.post).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({userId: '2'}),
            {headers: {Authorization: 'Bearer cached-token'}}
        );
    });

    it('sends no headers if no tokens are available anywhere', async () => {
        const {registerDeviceToken: register} = require('../../src/shared/services/deviceTokenRegistry');
        const {default: api} = require('../../src/shared/services/apiClient');
        const {getFreshStoredTokens: getTokens} = require('../../src/features/auth/sessionManager');

        // Fresh tokens null AND no cached token (first run)
        getTokens.mockResolvedValue(null);

        await register({userId: '1', token: 't1'});

        // The third arg (config) should be undefined
        expect(api.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            undefined
        );
    });
  });
});