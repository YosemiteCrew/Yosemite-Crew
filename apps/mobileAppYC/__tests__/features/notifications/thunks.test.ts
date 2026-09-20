import {configureStore} from '@reduxjs/toolkit';
import notificationReducer from '@/features/notifications/notificationSlice';
import {
  fetchNotificationsForCompanion,
  markNotificationAsRead,
  archiveNotification,
} from '@/features/notifications/thunks';
import {
  archiveMobileNotification,
  fetchMobileNotifications,
  markMobileNotificationSeen,
} from '@/features/notifications/services/notificationService';

jest.mock('@/features/notifications/services/notificationService');

const mockedFetchMobileNotifications =
  fetchMobileNotifications as jest.MockedFunction<
    typeof fetchMobileNotifications
  >;
const mockedMarkMobileNotificationSeen =
  markMobileNotificationSeen as jest.MockedFunction<
    typeof markMobileNotificationSeen
  >;
const mockedArchiveMobileNotification =
  archiveMobileNotification as jest.MockedFunction<
    typeof archiveMobileNotification
  >;

describe('Notification Thunks', () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchMobileNotifications.mockResolvedValue([]);
    mockedMarkMobileNotificationSeen.mockResolvedValue();
    mockedArchiveMobileNotification.mockResolvedValue();
    store = configureStore({
      reducer: {notifications: notificationReducer},
    });
  });

  const runSuccess = async (action: any) => {
    const res = await store.dispatch(action);
    expect(res.type).toMatch(/\/fulfilled$/);
    return res;
  };

  const runFailure = async (action: any, expectedMessage: string) => {
    const res = await store.dispatch(action);
    expect(res.type).toMatch(/\/rejected$/);
    expect(res.payload).toBe(expectedMessage);
  };

  describe('1. Success paths - each thunk calls its endpoint', () => {
    it('fetchNotificationsForCompanion resolves successfully', async () => {
      const res = await runSuccess(
        fetchNotificationsForCompanion({companionId: 'c1'}),
      );
      expect(mockedFetchMobileNotifications).toHaveBeenCalledTimes(1);
      expect(res.payload.companionId).toBe('c1');
      expect(res.payload.notifications).toEqual([]);
    });

    it('fetchNotificationsForCompanion falls back to the default companion', async () => {
      const res = await runSuccess(fetchNotificationsForCompanion({}));
      expect(res.payload.companionId).toBe('default-companion');
    });

    it('markNotificationAsRead posts to the seen endpoint', async () => {
      const res = await runSuccess(
        markNotificationAsRead({notificationId: '1'}),
      );
      expect(mockedMarkMobileNotificationSeen).toHaveBeenCalledWith('1');
      expect(res.payload.notificationId).toBe('1');
    });

    it('archiveNotification posts to the archive endpoint', async () => {
      const res = await runSuccess(archiveNotification({notificationId: '1'}));
      expect(mockedArchiveMobileNotification).toHaveBeenCalledWith('1');
      expect(res.payload.notificationId).toBe('1');
    });
  });

  describe('2. Error path - Error object', () => {
    beforeEach(() => {
      mockedFetchMobileNotifications.mockRejectedValue(
        new Error('Network Error'),
      );
      mockedMarkMobileNotificationSeen.mockRejectedValue(
        new Error('Network Error'),
      );
      mockedArchiveMobileNotification.mockRejectedValue(
        new Error('Network Error'),
      );
    });

    it('fetchNotificationsForCompanion surfaces the message', async () => {
      await runFailure(
        fetchNotificationsForCompanion({companionId: 'c1'}),
        'Network Error',
      );
    });

    it('markNotificationAsRead surfaces the message', async () => {
      await runFailure(
        markNotificationAsRead({notificationId: '1'}),
        'Network Error',
      );
    });

    it('archiveNotification surfaces the message, so a failed archive is not shown as done', async () => {
      await runFailure(
        archiveNotification({notificationId: '1'}),
        'Network Error',
      );
      expect(store.getState().notifications.error).toBe('Network Error');
    });
  });

  describe('3. Error path - non-Error value falls back to a fixed message', () => {
    beforeEach(() => {
      mockedFetchMobileNotifications.mockRejectedValue(
        'Something weird happened' as any,
      );
      mockedMarkMobileNotificationSeen.mockRejectedValue(
        'Something weird happened' as any,
      );
      mockedArchiveMobileNotification.mockRejectedValue(
        'Something weird happened' as any,
      );
    });

    it('fetchNotificationsForCompanion uses fallback message', async () => {
      await runFailure(
        fetchNotificationsForCompanion({companionId: 'c1'}),
        'Failed to fetch notifications',
      );
    });

    it('markNotificationAsRead uses fallback message', async () => {
      await runFailure(
        markNotificationAsRead({notificationId: '1'}),
        'Failed to mark notification as read',
      );
    });

    it('archiveNotification uses fallback message', async () => {
      await runFailure(
        archiveNotification({notificationId: '1'}),
        'Failed to archive notification',
      );
    });
  });
});
