// --- Mocks Setup ---

// 1. Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// 2. Mock Redux Actions
jest.mock('@/features/notifications', () => ({
  addNotificationToList: jest.fn(payload => ({type: 'MOCK_ADD_LIST', payload})),
}));

// 3. Mock Firebase App
const mockFirebaseApps = {
  getApps: jest.fn(() => [{name: '[DEFAULT]'}]),
};
jest.mock('@react-native-firebase/app', () => ({
  getApps: mockFirebaseApps.getApps,
}));

// 4. Mock React Native (Explicit mock to prevent TurboModule crashes)
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
    select: jest.fn(objs => objs.android),
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
    isDeviceRegisteredForRemoteMessages:
      mockMessaging.isDeviceRegisteredForRemoteMessages,
    registerDeviceForRemoteMessages:
      mockMessaging.registerDeviceForRemoteMessages,
    setAutoInitEnabled: mockMessaging.setAutoInitEnabled,
  };
});

// 6. Mock Notifee
const mockNotifee = {
  displayNotification: jest.fn(() => Promise.resolve()),
  createChannel: jest.fn(() => Promise.resolve()),
  getChannel: jest.fn(() => Promise.resolve(null)),
  requestPermission: jest.fn(() => Promise.resolve({authorizationStatus: 1})),
  getNotificationSettings: jest.fn(() =>
    Promise.resolve({authorizationStatus: 1}),
  ),
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
  AndroidImportance: {HIGH: 4},
  AndroidVisibility: {PUBLIC: 1},
  AuthorizationStatus: {AUTHORIZED: 1, DENIED: 0, NOT_DETERMINED: -1},
  EventType: {PRESS: 1, DISMISSED: 2, ACTION_PRESS: 3},
  TriggerType: {TIMESTAMP: 1},
  TimeUnit: {MINUTES: 'minutes'},
}));

// 7. Mock localization
// The service resolves its lock-screen wording through i18next rather than
// hardcoding English, so these stand in for a reader's chosen language.
const TRANSLATIONS: Record<string, string> = {
  'notifications.lockScreen.title': 'Yosemite Crew',
  'notifications.lockScreen.body': 'You have an update. Open the app to see it.',
};
const mockT = jest.fn((key: string) => TRANSLATIONS[key] ?? key);
jest.mock('@/localization', () => ({
  __esModule: true,
  default: {t: (key: string) => mockT(key)},
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
    mockFirebaseApps.getApps.mockReturnValue([{name: '[DEFAULT]'}]);
    // clearAllMocks leaves implementations in place, so a test that returns
    // another language must not leak into the next one.
    mockT.mockImplementation((key: string) => TRANSLATIONS[key] ?? key);
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
    it('skips push setup when no native Firebase app is configured', async () => {
      mockFirebaseApps.getApps.mockReturnValue([]);
      const {initializeNotifications, areNotificationsInitialized} =
        loadService();

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockMessaging.getToken).not.toHaveBeenCalled();
      expect(mockNotifee.getNotificationSettings).not.toHaveBeenCalled();
      expect(areNotificationsInitialized()).toBe(false);
    });

    it('initializes correctly on Android', async () => {
      const {initializeNotifications, areNotificationsInitialized} =
        loadService();
      const {PermissionsAndroid} = require('react-native');

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
        expect.objectContaining({id: 'yc_general_notifications'}),
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
      const {initializeNotifications} = loadService();

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
      const {initializeNotifications} = loadService();
      // Re-require after loadService() so this points at the same mock
      // instance the freshly-loaded (post jest.resetModules()) service uses.
      const freshAsyncStorage = require('@react-native-async-storage/async-storage');
      const pendingData = {
        navigationId: 'tasks',
        screen: 'TasksMain',
        tab: 'Tasks',
      };

      (freshAsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(pendingData),
      );

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(freshAsyncStorage.removeItem).toHaveBeenCalledWith(
        '@yc/pending-notification-intent',
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({tab: 'Tasks', stackScreen: 'TasksMain'}),
      );
    });

    it('processes initial notification from Notifee', async () => {
      const {initializeNotifications} = loadService();

      mockNotifee.getInitialNotification.mockResolvedValue({
        notification: {data: {deepLink: 'yosemite://chat'}},
      });

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({deepLink: 'yosemite://chat'}),
      );
    });

    it('short-circuits on a second call once already initialized', async () => {
      const {initializeNotifications, areNotificationsInitialized} =
        loadService();

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      expect(areNotificationsInitialized()).toBe(true);

      jest.clearAllMocks();
      const secondNavigate = jest.fn();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: secondNavigate,
      });

      // Should not re-run permission/channel/token setup.
      expect(mockMessaging.getToken).not.toHaveBeenCalled();
      expect(mockNotifee.createChannel).not.toHaveBeenCalled();
    });

    it('propagates the token error on non-iOS platforms instead of swallowing it', async () => {
      Platform.OS = 'android';
      const {initializeNotifications} = loadService();
      mockMessaging.getToken.mockRejectedValue(new Error('Token boom'));

      await expect(
        initializeNotifications({
          dispatch: mockDispatch,
          onNavigate: mockNavigate,
        }),
      ).rejects.toThrow('Token boom');
    });

    it('does not call onTokenUpdate when no initial token is returned', async () => {
      const {initializeNotifications} = loadService();
      mockMessaging.getToken.mockResolvedValue(null as any);

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
        onTokenUpdate: mockTokenUpdate,
      });

      expect(mockTokenUpdate).not.toHaveBeenCalled();
    });

    it('falls back to the Firebase Messaging initial notification when Notifee has none', async () => {
      const {initializeNotifications} = loadService();
      mockNotifee.getInitialNotification.mockResolvedValue(null);
      mockMessaging.getInitialNotification.mockResolvedValue({
        data: {deepLink: 'yosemite://messaging-fallback'},
      });

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({deepLink: 'yosemite://messaging-fallback'}),
      );
    });

    it('does not navigate when neither Notifee nor Messaging report an initial notification', async () => {
      const {initializeNotifications} = loadService();
      mockNotifee.getInitialNotification.mockResolvedValue(null);
      mockMessaging.getInitialNotification.mockResolvedValue(null);

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('requests permission when the current authorization status is denied', async () => {
      const {initializeNotifications} = loadService();
      mockNotifee.getNotificationSettings.mockResolvedValue({
        authorizationStatus: 0, // DENIED
      });

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(mockNotifee.requestPermission).toHaveBeenCalledWith(
        expect.objectContaining({alert: true, badge: true, sound: true}),
      );
    });

    it('calls onTokenUpdate when the FCM token refreshes', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
        onTokenUpdate: mockTokenUpdate,
      });

      const refreshCallback = mockMessaging.onTokenRefresh.mock.calls[0][1];
      await refreshCallback('new_token');

      expect(mockTokenUpdate).toHaveBeenCalledWith('new_token');
    });

    it('does not throw when a token refreshes without an onTokenUpdate handler', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const refreshCallback = mockMessaging.onTokenRefresh.mock.calls[0][1];
      await expect(refreshCallback('new_token')).resolves.toBeUndefined();
    });
  });

  describe('Message Handling', () => {
    const mockRemoteMessage: any = {
      messageId: 'msg_123',
      notification: {title: 'Test', body: 'Body'},
      data: {category: 'tasks', priority: 'high'},
    };

    it('seats the notification in the list and displays via Notifee', async () => {
      const {initializeNotifications} = loadService();

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
          android: expect.objectContaining({
            channelId: 'yc_general_notifications',
          }),
        }),
      );
    });

    it('keys the seated item by the id the backend sent, so it can be archived', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        ...mockRemoteMessage,
        data: {...mockRemoteMessage.data, notificationId: 'row-42'},
      });

      const [[payload]] = require('@/features/notifications')
        .addNotificationToList.mock.calls;
      expect(payload.id).toBe('row-42');
      expect(payload.status).toBe('unread');
    });

    it('falls back to a local id when the push carries none', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback(mockRemoteMessage);

      const [[payload]] = require('@/features/notifications')
        .addNotificationToList.mock.calls;
      expect(payload.id).toMatch(/^notif_\d+$/);
    });

    it('handles background messages via exported handler', async () => {
      const {handleBackgroundRemoteMessage} = loadService();
      const bgMessage = {...mockRemoteMessage, data: {deepLink: 'bg://link'}};

      await handleBackgroundRemoteMessage(bgMessage);
    });

    describe('lock screen privacy', () => {
      // A locked phone shows whatever Notifee is handed, so this surface may
      // only ever carry the generic wording the server puts in the FCM
      // notification block. The real title and body arrive in `data` and are
      // for the in-app list only.
      const SENSITIVE = {
        title: 'Payment received',
        body: 'Use this code to continue: 483920. Valid for 10 minutes!',
      };

      const deliverForeground = async (message: any) => {
        const {initializeNotifications} = loadService();
        await initializeNotifications({
          dispatch: mockDispatch,
          onNavigate: mockNavigate,
        });
        const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];
        await registeredCallback(message);
      };

      const displayed = () => mockNotifee.displayNotification.mock.calls[0][0];

      const seated = () =>
        require('@/features/notifications').addNotificationToList.mock
          .calls[0][0];

      it('never puts the data body on the lock screen', async () => {
        await deliverForeground({
          messageId: 'msg_lock',
          notification: {title: 'Yosemite Crew', body: 'You have an update.'},
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(displayed().body).toBe('You have an update.');
        expect(displayed().body).not.toContain('483920');
      });

      it('never puts the data title on the lock screen', async () => {
        await deliverForeground({
          messageId: 'msg_lock',
          notification: {title: 'Yosemite Crew', body: 'You have an update.'},
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(displayed().title).toBe('Yosemite Crew');
        expect(displayed().title).not.toContain('Payment');
      });

      it('shows generic wording when the push carries no notification block', async () => {
        // A data-only push never reaches the OS renderer, so Notifee presents it
        // on its own. It must still not surface the record wording.
        await deliverForeground({
          messageId: 'msg_data_only',
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(displayed().body).not.toContain('483920');
        expect(displayed().title).not.toContain('Payment');
        expect(displayed().title).toBeTruthy();
      });

      it('resolves the fallback wording through i18next, not a hardcoded string', async () => {
        await deliverForeground({
          messageId: 'msg_data_only',
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(mockT).toHaveBeenCalledWith('notifications.lockScreen.title');
        expect(mockT).toHaveBeenCalledWith('notifications.lockScreen.body');
      });

      it('shows the reader their own language when the server marked the block generic', async () => {
        // The server marks its placeholder block so the app can substitute the
        // same sentence in the reader's language. It must not echo the English
        // the server happened to send.
        mockT.mockImplementation((key: string) =>
          key === 'notifications.lockScreen.body'
            ? 'Tienes una actualización. Abre la aplicación para verla.'
            : TRANSLATIONS[key],
        );

        await deliverForeground({
          messageId: 'msg_marked',
          notification: {
            title: 'Yosemite Crew',
            body: 'You have an update. Open the app to see it.',
          },
          data: {notificationId: 'row-1', lockScreen: 'generic', ...SENSITIVE},
        });

        expect(displayed().body).toBe(
          'Tienes una actualización. Abre la aplicación para verla.',
        );
      });

      it('still shows the in-app list the record wording when the block is marked generic', async () => {
        await deliverForeground({
          messageId: 'msg_marked',
          notification: {
            title: 'Yosemite Crew',
            body: 'You have an update. Open the app to see it.',
          },
          data: {notificationId: 'row-1', lockScreen: 'generic', ...SENSITIVE},
        });

        expect(seated().title).toBe(SENSITIVE.title);
        expect(seated().description).toBe(SENSITIVE.body);
      });

      it('leaves an unmarked notification block exactly as the server sent it', async () => {
        // Not every server marks its block. An unmarked one may be the app's
        // own wording and is passed through untouched.
        await deliverForeground({
          messageId: 'msg_unmarked',
          notification: {title: 'Yosemite Crew', body: 'Something to read.'},
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(displayed().body).toBe('Something to read.');
        expect(mockT).not.toHaveBeenCalled();
      });

      it('still shows the real title and body in the in-app list', async () => {
        await deliverForeground({
          messageId: 'msg_lock',
          notification: {title: 'Yosemite Crew', body: 'You have an update.'},
          data: {notificationId: 'row-1', ...SENSITIVE},
        });

        expect(seated().title).toBe(SENSITIVE.title);
        expect(seated().description).toBe(SENSITIVE.body);
      });

      it('prefers the data wording over the generic block in the in-app list', async () => {
        // The data block is the record's own wording. When both are present the
        // person inside the app should read the real one.
        await deliverForeground({
          messageId: 'msg_lock',
          notification: {title: 'Yosemite Crew', body: 'You have an update.'},
          data: {title: 'Task due', body: 'Walk the dog at 6pm.'},
        });

        expect(seated().title).toBe('Task due');
        expect(seated().description).toBe('Walk the dog at 6pm.');
      });
    });

    it('normalizes a recognized relatedType and extracts metadata keys', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_meta',
        notification: {title: 'Meta', body: 'Body'},
        data: {
          category: 'tasks',
          relatedType: 'appointment',
          navigationId: 'nav-1',
          trackingId: 'track-1',
        },
      });

      const [[payload]] = require('@/features/notifications')
        .addNotificationToList.mock.calls;
      expect(payload.relatedType).toBe('appointment');
      expect(payload.metadata.navigationId).toBe('nav-1');
      expect(payload.metadata.trackingId).toBe('track-1');
    });

    it('ignores an unrecognized relatedType', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_bad_related',
        notification: {title: 'Meta', body: 'Body'},
        data: {relatedType: 'not-a-real-type'},
      });

      const [[payload]] = require('@/features/notifications')
        .addNotificationToList.mock.calls;
      expect(payload.relatedType).toBeUndefined();
    });

    it('includes largeIcon in the android config when an image url is present', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_icon',
        notification: {
          title: 'Icon',
          body: 'Body',
          android: {imageUrl: 'https://example.com/pic.png'},
        },
        data: {},
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            largeIcon: 'https://example.com/pic.png',
          }),
        }),
      );
    });

    it('normalizes a plain android resource name for smallIcon', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_small_icon',
        notification: {title: 'Icon', body: 'Body'},
        data: {smallIcon: 'Custom_Icon_1'},
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({smallIcon: 'custom_icon_1'}),
        }),
      );
    });

    it('falls back to ic_launcher for a smallIcon with invalid characters', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_bad_icon',
        notification: {title: 'Icon', body: 'Body'},
        data: {smallIcon: 'not a valid icon!'},
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({smallIcon: 'ic_launcher'}),
        }),
      );
    });

    it('falls back to ic_launcher for a whitespace-only smallIcon', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_blank_icon',
        notification: {title: 'Icon', body: 'Body'},
        data: {smallIcon: '   '},
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({smallIcon: 'ic_launcher'}),
        }),
      );
    });

    it('handles a message with no data payload at all', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await expect(
        registeredCallback({
          messageId: 'msg_no_data',
          notification: {title: 'NoData', body: 'Body'},
        }),
      ).resolves.toBeUndefined();
    });

    it('coerces unserializable data values (e.g. BigInt) to a fallback string', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      await registeredCallback({
        messageId: 'msg_bigint',
        notification: {title: 'Big', body: 'Body'},
        data: {weird: BigInt(10) as any},
      });

      expect(mockNotifee.displayNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({weird: '[unserializable]'}),
        }),
      );
    });
  });

  describe('Notifee Event Handling', () => {
    it('handles foreground PRESS event', async () => {
      const {initializeNotifications} = loadService();
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
            data: {navigationId: 'appointments'}, // Maps to 'MyAppointments'
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
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];

      const event = {
        type: 3, // EventType.ACTION_PRESS
        detail: {
          pressAction: {id: 'mark-as-read'},
          notification: {data: {deepLink: 'app://read'}},
        },
      };

      await onEventCallback(event);

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({deepLink: 'app://read'}),
      );
    });

    it('stores a pending intent for a foreground PRESS when no navigation handler is registered', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: undefined as any,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];

      const event = {
        type: 1, // EventType.PRESS
        detail: {
          notification: {
            id: 'n2',
            data: {navigationId: 'appointments'},
          },
        },
      };

      await onEventCallback(event);

      expect(mockNavigate).not.toHaveBeenCalled();
      const freshAsyncStorage = require('@react-native-async-storage/async-storage');
      expect(freshAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({navigationId: 'appointments'}),
      );
    });

    it('stores intent on background PRESS', async () => {
      const {handleNotificationBackgroundEvent} = loadService();
      const event: any = {
        type: 1, // EventType.PRESS
        detail: {
          notification: {data: {foo: 'bar'}},
        },
      };

      await handleNotificationBackgroundEvent(event);
    });

    it('cancels the notification on background mark-as-read', async () => {
      const {handleNotificationBackgroundEvent} = loadService();
      const event: any = {
        type: 3, // EventType.ACTION_PRESS
        detail: {
          pressAction: {id: 'mark-as-read'},
          notification: {id: 'bg-n1'},
        },
      };

      await handleNotificationBackgroundEvent(event);

      expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('bg-n1');
    });

    it('cancels the notification on foreground DISMISSED', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];
      await onEventCallback({
        type: 2, // EventType.DISMISSED
        detail: {notification: {id: 'n-dismissed'}},
      });

      expect(mockNotifee.cancelNotification).toHaveBeenCalledWith(
        'n-dismissed',
      );
    });

    it('does nothing for an unrecognized foreground event type', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];
      await expect(
        onEventCallback({type: 999, detail: {}}),
      ).resolves.toBeUndefined();
      expect(mockNotifee.cancelNotification).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Intent Persistence', () => {
    it('warns but does not throw when persisting a pending intent fails', async () => {
      const {handleNotificationBackgroundEvent} = loadService();
      // Re-require after loadService() so this points at the same mock
      // instance the freshly-loaded (post jest.resetModules()) service uses.
      const freshAsyncStorage = require('@react-native-async-storage/async-storage');
      (freshAsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('disk full'),
      );

      const event: any = {
        type: 1, // EventType.PRESS
        detail: {notification: {data: {foo: 'bar'}}},
      };

      await handleNotificationBackgroundEvent(event);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Notifications] Failed to persist navigation intent',
        expect.any(Error),
      );
    });

    it('warns but does not throw when reading a pending intent fails during init', async () => {
      const {initializeNotifications} = loadService();
      const freshAsyncStorage = require('@react-native-async-storage/async-storage');
      (freshAsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('read fail'),
      );

      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Notifications] Failed to read stored navigation intent',
        expect.any(Error),
      );
    });

    it('falls back to a raw value wrapper when stored params are not valid JSON', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];
      await onEventCallback({
        type: 1, // EventType.PRESS
        detail: {
          notification: {
            data: {navigationId: 'tasks', params: 'not-json'},
          },
        },
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({params: {value: 'not-json'}}),
      );
    });

    it('does not navigate when the intent has neither a screen, tab, nor deep link', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      const onEventCallback = mockNotifee.onForegroundEvent.mock.calls[0][0];
      await onEventCallback({
        type: 1, // EventType.PRESS
        detail: {
          notification: {id: 'n-empty', data: {unrelatedKey: 'x'}},
        },
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('n-empty');
    });
  });

  describe('Utilities', () => {
    it('schedules local reminder', async () => {
      const {scheduleLocalReminder} = loadService();
      mockNotifee.getChannel.mockResolvedValue({
        id: 'yc_general_notifications',
      });

      await scheduleLocalReminder('Title', 'Body', 10);

      expect(mockNotifee.createTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({title: 'Title'}),
        expect.objectContaining({type: 1}), // TriggerType.TIMESTAMP
      );
    });

    it('clears all notifications', async () => {
      const {clearAllSystemNotifications} = loadService();
      await clearAllSystemNotifications();
      expect(mockNotifee.cancelAllNotifications).toHaveBeenCalled();
    });

    it('gets current FCM token', async () => {
      Platform.OS = 'ios';
      const {getCurrentFcmToken} = loadService();

      mockMessaging.isDeviceRegisteredForRemoteMessages.mockReturnValue(true);
      mockMessaging.getToken.mockResolvedValue('token_abc');

      const token = await getCurrentFcmToken();
      expect(token).toBe('token_abc');
    });

    it('returns null on token failure', async () => {
      const {getCurrentFcmToken} = loadService();

      // Override default success with rejection for this test only
      mockMessaging.getToken.mockRejectedValue(new Error('Fail'));

      const token = await getCurrentFcmToken();
      expect(token).toBeNull();
    });
  });

  describe('Data Normalization', () => {
    it('coerces non-string data to strings', async () => {
      const {initializeNotifications} = loadService();
      await initializeNotifications({
        dispatch: mockDispatch,
        onNavigate: mockNavigate,
      });

      // Get registered callback from arguments (2nd arg is callback)
      const registeredCallback = mockMessaging.onMessage.mock.calls[0][1];

      const rawData = {
        id: 123,
        active: true,
        meta: {nested: 'val'},
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
            meta: JSON.stringify({nested: 'val'}),
            empty: '',
          },
        }),
      );
    });
  });
});

describe('lock screen translation resources', () => {
  // The service resolves these keys through i18next. A missing or untranslated
  // key would show the raw key on a locked phone, so the resources themselves
  // are asserted rather than trusted.
  const locales = ['en', 'es'] as const;

  it.each(locales)('defines the lock screen wording in %s', locale => {
    const resource = require(`../../src/localization/resources/${locale}/common.json`);

    expect(resource.notifications?.lockScreen?.title).toBeTruthy();
    expect(resource.notifications?.lockScreen?.body).toBeTruthy();
  });

  it('translates the Spanish body rather than repeating the English one', () => {
    const en = require('../../src/localization/resources/en/common.json');
    const es = require('../../src/localization/resources/es/common.json');

    expect(es.notifications.lockScreen.body).not.toBe(
      en.notifications.lockScreen.body,
    );
  });

  it('keeps the app name untranslated as the lock screen title', () => {
    const en = require('../../src/localization/resources/en/common.json');
    const es = require('../../src/localization/resources/es/common.json');

    expect(es.notifications.lockScreen.title).toBe(
      en.notifications.lockScreen.title,
    );
  });
});
