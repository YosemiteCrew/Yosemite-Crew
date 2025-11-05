import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {Notification, NotificationsState, NotificationCategory} from './types';
import {
  fetchNotificationsForCompanion,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  archiveNotification,
  clearAllNotifications,
} from './thunks';

const initialState: NotificationsState = {
  items: [],
  loading: false,
  error: null,
  unreadCount: 0,
  hydratedCompanions: {},
  lastFetchTimestamp: undefined,
  filter: 'all',
  sortBy: 'newest',
};

export const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotificationFilter(state, action: PayloadAction<NotificationCategory>) {
      state.filter = action.payload;
    },
    setSortBy(state, action: PayloadAction<'newest' | 'oldest' | 'priority'>) {
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
      state.unreadCount = action.payload.filter(n => n.status === 'unread').length;
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
      .addCase(fetchNotificationsForCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationsForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.notifications;
        state.hydratedCompanions[action.payload.companionId] = true;
        state.lastFetchTimestamp = Date.now();
        state.unreadCount = action.payload.notifications.filter(
          n => n.status === 'unread',
        ).length;
        state.error = null;
      })
      .addCase(fetchNotificationsForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch notifications';
      })

      // Create notification
      .addCase(createNotification.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
        if (action.payload.status === 'unread') {
          state.unreadCount += 1;
        }
        state.error = null;
      })
      .addCase(createNotification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to create notification';
      })

      // Mark as read
      .addCase(markNotificationAsRead.pending, state => {
        state.error = null;
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.items.find(n => n.id === action.payload.notificationId);
        if (notification && notification.status === 'unread') {
          notification.status = 'read';
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to mark notification as read';
      })

      // Mark all as read
      .addCase(markAllNotificationsAsRead.pending, state => {
        state.error = null;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, state => {
        state.items.forEach(notification => {
          if (notification.status === 'unread') {
            notification.status = 'read';
          }
        });
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to mark notifications as read';
      })

      // Delete notification
      .addCase(deleteNotification.pending, state => {
        state.error = null;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const index = state.items.findIndex(n => n.id === action.payload.notificationId);
        if (index !== -1) {
          const notification = state.items[index];
          if (notification.status === 'unread') {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.items.splice(index, 1);
        }
      })
      .addCase(deleteNotification.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to delete notification';
      })

      // Archive notification
      .addCase(archiveNotification.pending, state => {
        state.error = null;
      })
      .addCase(archiveNotification.fulfilled, (state, action) => {
        const notification = state.items.find(n => n.id === action.payload.notificationId);
        if (notification) {
          if (notification.status === 'unread') {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          notification.status = 'archived';
        }
      })
      .addCase(archiveNotification.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to archive notification';
      })

      // Clear all notifications
      .addCase(clearAllNotifications.pending, state => {
        state.error = null;
      })
      .addCase(clearAllNotifications.fulfilled, state => {
        state.items = state.items.filter(n => n.status === 'archived');
        state.unreadCount = 0;
      })
      .addCase(clearAllNotifications.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to clear notifications';
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
