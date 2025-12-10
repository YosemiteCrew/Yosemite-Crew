import { configureStore } from '@reduxjs/toolkit';
import notificationReducer from '@/features/notifications/notificationSlice';
import {
  fetchNotificationsForCompanion,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  archiveNotification,
  clearAllNotifications
} from '@/features/notifications/thunks';
import {
  fetchMobileNotifications,
  markMobileNotificationSeen,
} from '@/features/notifications/services/notificationService';

jest.mock('@/features/notifications/services/notificationService');

const mockedFetchMobileNotifications = fetchMobileNotifications as jest.MockedFunction<
  typeof fetchMobileNotifications
>;
const mockedMarkMobileNotificationSeen = markMobileNotificationSeen as jest.MockedFunction<
  typeof markMobileNotificationSeen
>;

describe('Notification Thunks', () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedFetchMobileNotifications.mockResolvedValue([]);
    mockedMarkMobileNotificationSeen.mockResolvedValue();
    store = configureStore({
      reducer: { notifications: notificationReducer },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper to run successful thunks
  const runSuccess = async (action: any) => {
    const promise = store.dispatch(action);
    jest.runAllTimers();
    const res = await promise;
    expect(res.type).toMatch(/\/fulfilled$/);
    return res;
  };

  // Helper to run failed thunks
  const runFailure = async (action: any, expectedMessage: string) => {
    const promise = store.dispatch(action);
    // We don't need runAllTimers here because our mock throws synchronously
    const res = await promise;
    expect(res.type).toMatch(/\/rejected$/);
    expect(res.payload).toBe(expectedMessage);
  };

  describe('1. Success Paths (Happy Path)', () => {
    it('fetchNotificationsForCompanion resolves successfully', async () => {
      const res = await runSuccess(fetchNotificationsForCompanion({ companionId: 'c1' }));
      expect(res.payload.companionId).toBe('c1');
      expect(res.payload.notifications).toEqual([]);
    });

    it('createNotification resolves successfully', async () => {
      const payload = { title: 'Test', category: 'messages', companionId: 'c1' };
      const res = await runSuccess(createNotification(payload as any));
      expect(res.payload.title).toBe('Test');
      expect(res.payload.id).toBeDefined();
    });

    it('markNotificationAsRead resolves successfully', async () => {
      const res = await runSuccess(markNotificationAsRead({ notificationId: '1' }));
      expect(res.payload.notificationId).toBe('1');
    });

    it('markAllNotificationsAsRead resolves successfully', async () => {
      const res = await runSuccess(markAllNotificationsAsRead({ companionId: 'c1' }));
      expect(res.payload.companionId).toBe('c1');
    });

    it('deleteNotification resolves successfully', async () => {
      const res = await runSuccess(deleteNotification({ notificationId: '1' }));
      expect(res.payload.notificationId).toBe('1');
    });

    it('archiveNotification resolves successfully', async () => {
      const res = await runSuccess(archiveNotification({ notificationId: '1' }));
      expect(res.payload.notificationId).toBe('1');
    });

    it('clearAllNotifications resolves successfully', async () => {
      await runSuccess(clearAllNotifications());
    });
  });

  // --------------------------------------------------------------------------
  // BRANCH COVERAGE: error instanceof Error ? TRUE : ...
  // --------------------------------------------------------------------------
  describe('2. Error Path: Standard Error Object', () => {
    beforeEach(() => {
      // Mock setTimeout to throw a real Error object
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
        throw new Error('Network Error');
      });
      mockedFetchMobileNotifications.mockRejectedValue(new Error('Network Error'));
      mockedMarkMobileNotificationSeen.mockRejectedValue(new Error('Network Error'));
    });

    it('fetchNotificationsForCompanion catches Error object', async () => {
      await runFailure(fetchNotificationsForCompanion({ companionId: 'c1' }), 'Network Error');
    });

    it('createNotification catches Error object', async () => {
      await runFailure(createNotification({} as any), 'Network Error');
    });

    it('markNotificationAsRead catches Error object', async () => {
      await runFailure(markNotificationAsRead({ notificationId: '1' }), 'Network Error');
    });

    it('markAllNotificationsAsRead catches Error object', async () => {
      await runFailure(markAllNotificationsAsRead({ companionId: 'c1' }), 'Network Error');
    });

    it('deleteNotification catches Error object', async () => {
      await runFailure(deleteNotification({ notificationId: '1' }), 'Network Error');
    });

    it('archiveNotification catches Error object', async () => {
      await runFailure(archiveNotification({ notificationId: '1' }), 'Network Error');
    });

    it('clearAllNotifications catches Error object', async () => {
      await runFailure(clearAllNotifications(), 'Network Error');
    });
  });

  // --------------------------------------------------------------------------
  // BRANCH COVERAGE: error instanceof Error ? ... : FALSE (Default String)
  // --------------------------------------------------------------------------
  describe('3. Error Path: Non-Error Object (Fallback Messages)', () => {
    beforeEach(() => {
      // Mock setTimeout to throw a string (not an Error instance)
      // This forces the 'else' branch in the catch block
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
        throw 'Something weird happened';
      });
      mockedFetchMobileNotifications.mockRejectedValue('Something weird happened' as any);
      mockedMarkMobileNotificationSeen.mockRejectedValue('Something weird happened' as any);
    });

    it('fetchNotificationsForCompanion uses fallback message', async () => {
      await runFailure(
        fetchNotificationsForCompanion({ companionId: 'c1' }),
        'Failed to fetch notifications'
      );
    });

    it('createNotification uses fallback message', async () => {
      await runFailure(
        createNotification({} as any),
        'Failed to create notification'
      );
    });

    it('markNotificationAsRead uses fallback message', async () => {
      await runFailure(
        markNotificationAsRead({ notificationId: '1' }),
        'Failed to mark notification as read'
      );
    });

    it('markAllNotificationsAsRead uses fallback message', async () => {
      await runFailure(
        markAllNotificationsAsRead({ companionId: 'c1' }),
        'Failed to mark notifications as read'
      );
    });

    it('deleteNotification uses fallback message', async () => {
      await runFailure(
        deleteNotification({ notificationId: '1' }),
        'Failed to delete notification'
      );
    });

    it('archiveNotification uses fallback message', async () => {
      await runFailure(
        archiveNotification({ notificationId: '1' }),
        'Failed to archive notification'
      );
    });

    it('clearAllNotifications uses fallback message', async () => {
      await runFailure(
        clearAllNotifications(),
        'Failed to clear notifications'
      );
    });
  });
});
