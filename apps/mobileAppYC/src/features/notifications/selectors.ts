import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {NotificationCategory} from './types';
import {notificationsInitialState} from './notificationSlice';

const getNotificationsState = (state: RootState) =>
  state.notifications ?? notificationsInitialState;

// Base selectors
export const selectNotificationsState = getNotificationsState;

export const selectAllNotifications = (state: RootState) =>
  getNotificationsState(state).items;

export const selectNotificationsLoading = (state: RootState) =>
  getNotificationsState(state).loading;

export const selectNotificationsError = (state: RootState) =>
  getNotificationsState(state).error;

export const selectUnreadCount = (state: RootState) =>
  getNotificationsState(state).unreadCount;

export const selectNotificationFilter = (state: RootState) =>
  getNotificationsState(state).filter;

export const selectNotificationSortBy = (state: RootState) =>
  getNotificationsState(state).sortBy;

export const selectHasHydratedCompanion = (companionId: string | null) =>
  createSelector(
    [selectNotificationsState],
    state => (companionId ? state.hydratedCompanions[companionId] : false),
  );

export const selectLastFetchTimestamp = (state: RootState) =>
  getNotificationsState(state).lastFetchTimestamp;

// Notifications by companion
export const selectNotificationsForCompanion = (companionId: string | null) =>
  createSelector([selectAllNotifications], notifications => {
    if (!companionId) return [];
    return notifications.filter(n => n.companionId === companionId);
  });

// Notifications by status
export const selectUnreadNotifications = createSelector(
  [selectAllNotifications],
  notifications => notifications.filter(n => n.status === 'unread'),
);

export const selectReadNotifications = createSelector(
  [selectAllNotifications],
  notifications => notifications.filter(n => n.status === 'read'),
);

export const selectArchivedNotifications = createSelector(
  [selectAllNotifications],
  notifications => notifications.filter(n => n.status === 'archived'),
);

// Notifications by category
export const selectNotificationsByCategory = (category: NotificationCategory) =>
  createSelector([selectAllNotifications], notifications => {
    if (category === 'all') return notifications;
    return notifications.filter(n => n.category === category);
  });

// Notifications by priority
export const selectHighPriorityNotifications = createSelector(
  [selectAllNotifications],
  notifications => notifications.filter(n => n.priority === 'high' || n.priority === 'urgent'),
);

// Filtered and sorted notifications
export const selectFilteredAndSortedNotifications = createSelector(
  [selectAllNotifications, selectNotificationFilter, selectNotificationSortBy],
  (notifications, filter, sortBy) => {
    // Filter by category
    let filtered = notifications;
    if (filter !== 'all') {
      filtered = notifications.filter(n => n.category === filter);
    }

    // Status filter: 'new' => only unread, 'seen' => only read
    const statusMode = sortBy === 'seen' ? 'seen' : 'new';
    if (statusMode === 'new') {
      filtered = filtered.filter(n => n.status === 'unread');
    } else if (statusMode === 'seen') {
      filtered = filtered.filter(n => n.status === 'read');
    }

    // Sort by most recent within the filtered set
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return sorted;
  },
);

// Notifications for companion with filtering
export const selectFilteredNotificationsForCompanion = (companionId: string | null) =>
  createSelector(
    [selectNotificationsForCompanion(companionId), selectNotificationFilter],
    (notifications, filter) => {
      if (filter === 'all') return notifications;
      return notifications.filter(n => n.category === filter);
    },
  );

// Sorted notifications for companion
export const selectSortedNotificationsForCompanion = (companionId: string | null) =>
  createSelector(
    [
      selectFilteredNotificationsForCompanion(companionId),
      selectNotificationSortBy,
    ],
    (notifications, sortBy) => {
      let filtered = notifications;
      const statusMode = sortBy === 'seen' ? 'seen' : 'new';
      // Apply status filter based on tab
      if (statusMode === 'new') {
        filtered = filtered.filter(n => n.status === 'unread');
      } else if (statusMode === 'seen') {
        filtered = filtered.filter(n => n.status === 'read');
      }

      return [...filtered].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    },
  );

// Unread count by category
export const selectUnreadCountByCategory = (category: NotificationCategory) =>
  createSelector(
    [selectUnreadNotifications],
    notifications => {
      if (category === 'all') return notifications.length;
      return notifications.filter(n => n.category === category).length;
    },
  );

// Single notification by ID
export const selectNotificationById = (notificationId: string) =>
  createSelector(
    [selectAllNotifications],
    notifications => notifications.find(n => n.id === notificationId),
  );

// Grouped notifications by category
export const selectNotificationsGroupedByCategory = createSelector(
  [selectAllNotifications],
  notifications => {
    const grouped: Record<NotificationCategory, typeof notifications> = {
      all: [],
      messages: [],
      appointments: [],
      tasks: [],
      documents: [],
      health: [],
      dietary: [],
      hygiene: [],
      payment: [],
    };

    for (const notification of notifications) {
      grouped[notification.category].push(notification);
    }

    return grouped;
  },
);

// Recent notifications (last N)
export const selectRecentNotifications = (limit: number = 10) =>
  createSelector([selectAllNotifications], notifications =>
    notifications.slice(0, limit),
  );

// Notifications ready for display (not archived, sorted)
export const selectDisplayNotifications = createSelector(
  [selectFilteredAndSortedNotifications],
  notifications => notifications.filter(n => n.status !== 'archived'),
);

// Unread urgent notifications
export const selectUnreadUrgentNotifications = createSelector(
  [selectUnreadNotifications],
  notifications => notifications.filter(n => n.priority === 'urgent'),
);
