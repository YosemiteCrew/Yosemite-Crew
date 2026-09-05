import {createAsyncThunk} from '@reduxjs/toolkit';
import type {Notification} from './types';
import {
  archiveMobileNotification,
  fetchMobileNotifications,
  markMobileNotificationSeen,
} from '@/features/notifications/services/notificationService';

/**
 * Fetch notifications for a companion
 */
export const fetchNotificationsForCompanion = createAsyncThunk<
  {companionId: string; notifications: Notification[]},
  {companionId?: string},
  {rejectValue: string}
>(
  'notifications/fetchForCompanion',
  async ({companionId}, {rejectWithValue}) => {
    try {
      const notifications = await fetchMobileNotifications();
      const resolvedCompanionId = companionId || 'default-companion';
      return {
        companionId: resolvedCompanionId,
        notifications,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : 'Failed to fetch notifications',
      );
    }
  },
);

/**
 * Mark notification as read
 */
export const markNotificationAsRead = createAsyncThunk<
  {notificationId: string},
  {notificationId: string},
  {rejectValue: string}
>('notifications/markAsRead', async ({notificationId}, {rejectWithValue}) => {
  try {
    await markMobileNotificationSeen(notificationId);
    return {notificationId};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error
        ? error.message
        : 'Failed to mark notification as read',
    );
  }
});

/**
 * Archive a notification
 */
export const archiveNotification = createAsyncThunk<
  {notificationId: string},
  {notificationId: string},
  {rejectValue: string}
>('notifications/archive', async ({notificationId}, {rejectWithValue}) => {
  try {
    await archiveMobileNotification(notificationId);
    return {notificationId};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to archive notification',
    );
  }
});
