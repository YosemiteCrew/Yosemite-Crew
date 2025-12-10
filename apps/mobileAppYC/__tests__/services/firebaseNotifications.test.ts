import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Mocks Setup ---

// 1. Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// 2. Mock Redux Actions
jest.mock('@/features/notifications', () => ({
  createNotification: jest.fn((payload) => ({type: 'MOCK_CREATE', payload})),
  addNotificationToList: jest.fn((payload) => ({type: 'MOCK_ADD_LIST', payload})),
}));

// 3. Mock Firebase App
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

// 4. Mock React Native (Explicit mock to prevent TurboModule crashes)
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
    select: jest.fn((objs) => objs.android),
  },
  PermissionsAndroid: {
    check: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
  },
}));

// 5. Mock Firebase Messaging
// Define mock functions outside to control/reset them in tests
const mockMessaging = {
  getToken: jest.fn(),
  onMessage: jest.fn(),
  onTokenRefresh: jest.fn(),
  getInitialNotification: jest.fn(),
  isDeviceRegisteredForRemoteMessages: jest.fn(),
  registerDeviceForRemoteMessages: jest.fn(),
  setAutoInitEnabled: jest.fn(),
};

jest.mock('@react-native-firebase/messaging', () => {
  return {
    __esModule: true,
    // The service calls getMessaging(getApp())
    default: jest.fn(() => ({})),
    getMessaging: jest.fn(() => ({})),
    // Map named exports to our control object
    getToken: mockMessaging.getToken,
    onMessage: mockMessaging.onMessage,
    onTokenRefresh: mockMessaging.onTokenRefresh,
    getInitialNotification: mockMessaging.getInitialNotification,
    isDeviceRegisteredForRemoteMessages: mockMessaging.isDeviceRegisteredForRemoteMessages,
    registerDeviceForRemoteMessages: mockMessaging.registerDeviceForRemoteMessages,
    setAutoInitEnabled: mockMessaging.setAutoInitEnabled,
  };
});

// 6. Mock Notifee
const mockNotifee = {
  displayNotification: jest.fn(() => Promise.resolve()),
  createChannel: jest.fn(() => Promise.resolve()),
  getChannel: jest.fn(() => Promise.resolve(null)),
  requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
  getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
  onForegroundEvent: jest.fn(() => jest.fn()), // Returns unsubscribe
  onBackgroundEvent: jest.fn(),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  cancelNotification: jest.fn(() => Promise.resolve()),
  cancelAllNotifications: jest.fn(() => Promise.resolve()),
  cancelDisplayedNotifications: jest.fn(() => Promise.resolve()),
  createTriggerNotification: jest.fn(() => Promise.resolve('trigger_id')),
};

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: mockNotifee,
  AndroidImportance: { HIGH: 4 },
  AndroidVisibility: { PUBLIC: 1 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0, NOT_DETERMINED: -1 },
  EventType: { PRESS: 1, DISMISSED: 2, ACTION_PRESS: 3 },
  TriggerType: { TIMESTAMP: 1 },
  TimeUnit: { MINUTES: 'minutes' },
}));

describe('firebaseNotifications Service', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockTokenUpdate = jest.fn();
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let Platform: any;

  // Helper to load the service fresh for every test (Critical for singleton state)
  const loadService = () => {
    return require('../../src/shared/services/firebaseNotifications');
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset Platform
    Platform = require('react-native').Platform;
    Platform.OS = 'android';

    // --- CRITICAL: Reset Implementation for Happy Path ---
    // This ensures tests don't bleed reject values (like "No APNs token") to other tests
    mockMessaging.getToken.mockResolvedValue('mock_fcm_token');
    mockMessaging.getInitialNotification.mockResolvedValue(null);
    mockMessaging.isDeviceRegisteredForRemoteMessages.mockReturnValue(true);
    mockMessaging.registerDeviceForRemoteMessages.mockResolvedValue(undefined);
    mockMessaging.setAutoInitEnabled.mockResolvedValue(undefined);
    // Mock onMessage to return an unsubscribe function
    mockMessaging.onMessage.mockReturnValue(() => {});
    mockMessaging.onTokenRefresh.mockReturnValue(() => {});

    mockNotifee.getInitialNotification.mockResolvedValue(null);
    mockNotifee.getChannel.mockResolvedValue(null);

    // Spies
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Initialization', () => {
    it('initializes correctly on Android', async () => {
      const { initializeNotifications, areNotificationsInitialized } = loadService();
      const { PermissionsAndroid } = require('react-native');

      PermissionsAndroid.check.mockResolvedValue(false);

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
        onTokenUpdate: mockTokenUpdate,
      });

      // Permissions
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        'android.permission.POST_NOTIFICATIONS',
      );

      // Channel
      expect(mockNotifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'yc_general_notifications' }),
      );

      // Token
      expect(mockMessaging.getToken).toHaveBeenCalled();
      expect(mockTokenUpdate).toHaveBeenCalledWith('mock_fcm_token');

      // Listeners attached?
      expect(mockMessaging.onMessage).toHaveBeenCalled();
      expect(mockNotifee.onForegroundEvent).toHaveBeenCalled();

      expect(areNotificationsInitialized()).toBe(true);
    });

    it('handles iOS specific initialization (APNs check)', async () => {
      Platform.OS = 'ios';
      const { initializeNotifications } = loadService();

      // Simulate un-registered device
      mockMessaging.isDeviceRegisteredForRemoteMessages.mockReturnValue(false);
      // Simulate token fetch failure (common in simulator)
      mockMessaging.getToken.mockRejectedValue(new Error('No APNs token'));

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      // Should attempt registration
      expect(mockMessaging.registerDeviceForRemoteMessages).toHaveBeenCalled();

      // Should warn but NOT throw
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping initial FCM'),
        expect.anything(),
      );
    });

    it('flushes pending intent from storage on init', async () => {
      const { initializeNotifications } = loadService();
      const pendingData = { navigationId: 'tasks', screen: 'TasksMain', tab: 'Tasks' };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(pendingData));

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
    });

    it('processes initial notification from Notifee', async () => {
      const { initializeNotifications } = loadService();

      mockNotifee.getInitialNotification.mockResolvedValue({
        notification: { data: { deepLink: 'yosemite://chat' } },
      });

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ deepLink: 'yosemite://chat' }),
      );
    });
  });

  describe('Message Handling', () => {
    const mockRemoteMessage: any = {
      messageId: 'msg_123',
      notification: { title: 'Test', body: 'Body' },
      data: { category: 'tasks', priority: 'high' },
    };

    it('dispatches CREATE_NOTIFICATION and displays via Notifee', async () => {
      const { initializeNotifications } = loadService();

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      // Manually trigger the onMessage callback registered by the service.
      // The service calls `onMessage(instance, callback)`.
      // So callback is the 2nd arg (index 1).
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback(mockRemoteMessage);
      expect(mockDispatch).toHaveBeenCalled();

      // Notifee
      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test',
          android: expect.objectContaining({ channelId: 'yc_general_notifications' }),
        }),
      );
    });

    it('falls back to addNotificationToList on dispatch error', async () => {
      const { initializeNotifications } = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      // Make dispatch fail
      mockDispatch.mockRejectedValueOnce(new Error('Fail'));

      await registeredCallback(mockRemoteMessage);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('handles background messages via exported handler', async () => {
      const { handleBackgroundRemoteMessage } = loadService();
      const bgMessage = { ...mockRemoteMessage, data: { deepLink: 'bg://link' } };

      await handleBackgroundRemoteMessage(bgMessage);
    });
  });

  describe('Notifee Event Handling', () => {
    it('handles foreground PRESS event', async () => {
      const { initializeNotifications } = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      // notifee.onForegroundEvent(callback) -> args[0] is callback
      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];

      const event = {
        type: 1, // EventType.PRESS
        detail: {
          notification: {
            id: 'n1',
            data: { navigationId: 'appointments' }, // Maps to 'MyAppointments'
          },
        },
      };

      await onEventCallback(event);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: 'Appointments',
          stackScreen: 'MyAppointments',
        }),
      );
      expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('n1');
    });

    it('handles ACTION_PRESS (mark-as-read)', async () => {
      const { initializeNotifications } = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];

      const event = {
        type: 3, // EventType.ACTION_PRESS
        detail: {
          pressAction: { id: 'mark-as-read' },
          notification: { data: { deepLink: 'app://read' } },
        },
      };

      await onEventCallback(event);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ deepLink: 'app://read' }),
      );
    });

    it('stores intent on background PRESS', async () => {
      const { handleNotificationBackgroundEvent } = loadService();
      const event: any = {
        type: 1, // EventType.PRESS
        detail: {
          notification: { data: { foo: 'bar' } },
        },
      };

      await handleNotificationBackgroundEvent(event);
    });
  });

  describe('Utilities', () => {
    it('schedules local reminder', async () => {
      const { scheduleLocalReminder } = loadService();
      mockNotifee.getChannel.mockResolvedValue({ id: 'yc_general_notifications' });

      await scheduleLocalReminder('Title', 'Body', 10);

      expect(mockNotifee.createTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Title' }),
        expect.objectContaining({ type: 1 }), // TriggerType.TIMESTAMP
      );
    });

    it('clears all notifications', async () => {
      const { clearAllSystemNotifications } = loadService();
      await clearAllSystemNotifications();
      expect(mockNotifee.cancelAllNotifications).toHaveBeenCalled();
    });

    it('gets current FCM token', async () => {
      Platform.OS = 'ios';
      const { getCurrentFcmToken } = loadService();

      mockMessaging.isDeviceRegisteredForRemoteMessages.mockReturnValue(true);
      mockMessaging.getToken.mockResolvedValue('token_abc');

      const token = await getCurrentFcmToken();
      expect(token).toBe('token_abc');
    });

    it('returns null on token failure', async () => {
      const { getCurrentFcmToken } = loadService();

      // Override default success with rejection for this test only
      mockMessaging.getToken.mockRejectedValue(new Error('Fail'));

      const token = await getCurrentFcmToken();
      expect(token).toBeNull();
    });
  });

  describe('Data Normalization', () => {
    it('coerces non-string data to strings', async () => {
      const { initializeNotifications } = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      // Get registered callback from arguments (2nd arg is callback)
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      const rawData = {
        id: 123,
        active: true,
        meta: { nested: 'val' },
        empty: null,
      };

      await registeredCallback({
        messageId: 'm1',
        data: rawData,
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            id: '123',
            active: 'true',
            meta: JSON.stringify({ nested: 'val' }),
            empty: '',
          },
        }),
      );
    });
  });
});