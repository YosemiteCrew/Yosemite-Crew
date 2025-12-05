import {createAsyncThunk} from '@reduxjs/toolkit';
import type {Notification, CreateNotificationPayload} from './types';
import {
  fetchMobileNotifications,
  markMobileNotificationSeen,
} from '@/features/notifications/services/notificationService';

// Simulate network delay
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
        error instanceof Error ? error.message : 'Failed to fetch notifications',
      );
    }
  },
);

/**
 * Create a new notification
 */
export const createNotification = createAsyncThunk<
  Notification,
  CreateNotificationPayload,
  {rejectValue: string}
>(
  'notifications/create',
  async (payload, {rejectWithValue}) => {
    try {
      await mockDelay(300);
      // NOTE: Replace with actual API call when backend is ready
      // const response = await notificationService.create(payload);
      // return response;

      const notification: Notification = {
        id: `notif_${Date.now()}`,
        companionId: payload.companionId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        icon: payload.icon,
        avatarUrl: payload.avatarUrl,
        timestamp: new Date().toISOString(),
        status: 'unread',
        priority: payload.priority || 'medium',
        deepLink: payload.deepLink,
        relatedId: payload.relatedId,
        relatedType: payload.relatedType,
        metadata: payload.metadata,
      };

      return notification;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to create notification',
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
>(
  'notifications/markAsRead',
  async ({notificationId}, {rejectWithValue}) => {
    try {
      await markMobileNotificationSeen(notificationId);
      return {notificationId};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to mark notification as read',
      );
    }
  },
);

/**
 * Mark all notifications as read for a companion
 */
export const markAllNotificationsAsRead = createAsyncThunk<
  {companionId: string},
  {companionId: string},
  {rejectValue: string}
>(
  'notifications/markAllAsRead',
  async ({companionId}, {rejectWithValue}) => {
    try {
      await mockDelay(300);
      // NOTE: Replace with actual API call when backend is ready
      // await notificationService.markAllAsRead(companionId);
      return {companionId};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to mark notifications as read',
      );
    }
  },
);

/**
 * Delete a notification
 */
export const deleteNotification = createAsyncThunk<
  {notificationId: string},
  {notificationId: string},
  {rejectValue: string}
>(
  'notifications/delete',
  async ({notificationId}, {rejectWithValue}) => {
    try {
      await mockDelay(200);
      // NOTE: Replace with actual API call when backend is ready
      // await notificationService.delete(notificationId);
      return {notificationId};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete notification',
      );
    }
  },
);

/**
 * Archive a notification
 */
export const archiveNotification = createAsyncThunk<
  {notificationId: string},
  {notificationId: string},
  {rejectValue: string}
>(
  'notifications/archive',
  async ({notificationId}, {rejectWithValue}) => {
    try {
      await mockDelay(200);
      // NOTE: Replace with actual API call when backend is ready
      // await notificationService.archive(notificationId);
      return {notificationId};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to archive notification',
      );
    }
  },
);

/**
 * Clear all notifications
 */
export const clearAllNotifications = createAsyncThunk<
  void,
  void,
  {rejectValue: string}
>(
  'notifications/clearAll',
  async (_, {rejectWithValue}) => {
    try {
      await mockDelay(400);
      // NOTE: Replace with actual API call when backend is ready
      // await notificationService.clearAll();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to clear notifications',
      );
    }
  },
);
