import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {
  Notification,
  NotificationsState,
  NotificationCategory,
} from './types';
import {
  fetchNotificationsForCompanion,
  markNotificationAsRead,
  archiveNotification,
} from './thunks';

import {
  markCollectionFailed,
  markCollectionHydrated,
  markCollectionPending,
} from '@/shared/store/collectionLoadState';

const initialState: NotificationsState = {
  items: [],
  loading: false,
  error: null,
  unreadCount: 0,
  hydratedCompanions: {},
  failedCompanions: {},
  activeRequests: {},
  lastLoadedAt: {},
  lastFetchTimestamp: undefined,
  filter: 'all',
  sortBy: 'new',
};

export const notificationsInitialState = initialState;

export const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotificationFilter(state, action: PayloadAction<NotificationCategory>) {
      state.filter = action.payload;
    },
    setSortBy(state, action: PayloadAction<'new' | 'seen'>) {
      state.sortBy = action.payload;
    },
    clearNotificationError(state) {
      state.error = null;
    },
    resetNotificationState() {
      return initialState;
    },
    injectMockNotifications(state, action: PayloadAction<Notification[]>) {
      state.items = action.payload;
      state.unreadCount = action.payload.filter(
        n => n.status === 'unread',
      ).length;
    },
    addNotificationToList(state, action: PayloadAction<Notification>) {
      state.items.unshift(action.payload);
      if (action.payload.status === 'unread') {
        state.unreadCount += 1;
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch notifications
      .addCase(fetchNotificationsForCompanion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        markCollectionPending(
          state,
          action.meta?.arg?.companionId,
          action.meta?.requestId,
        );
      })
      .addCase(fetchNotificationsForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.notifications;
        markCollectionHydrated(
          state,
          action.payload.companionId,
          Date.now(),
          action.meta?.requestId,
        );
        state.lastFetchTimestamp = Date.now();
        state.unreadCount = action.payload.notifications.filter(
          n => n.status === 'unread',
        ).length;
        state.error = null;
      })
      .addCase(fetchNotificationsForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch notifications';
        markCollectionFailed(
          state,
          action.meta?.arg?.companionId,
          action.payload,
          action.meta?.requestId,
        );
      })

      // Mark as read
      .addCase(markNotificationAsRead.pending, state => {
        state.error = null;
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.items.find(
          n => n.id === action.payload.notificationId,
        );
        if (notification?.status === 'unread') {
          notification.status = 'read';
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to mark notification as read';
      })

      // Archive notification
      .addCase(archiveNotification.pending, state => {
        state.error = null;
      })
      .addCase(archiveNotification.fulfilled, (state, action) => {
        const notification = state.items.find(
          n => n.id === action.payload.notificationId,
        );
        if (notification) {
          if (notification.status === 'unread') {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          notification.status = 'archived';
        }
      })
      .addCase(archiveNotification.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to archive notification';
      });
  },
});

export const {
  setNotificationFilter,
  setSortBy,
  clearNotificationError,
  resetNotificationState,
  injectMockNotifications,
  addNotificationToList,
} = notificationSlice.actions;

export default notificationSlice.reducer;
