// Export types
export * from './types';

// Export slice and actions
export {default as notificationReducer} from './notificationSlice';
export {
  setNotificationFilter,
  setSortBy,
  clearNotificationError,
  resetNotificationState,
  injectMockNotifications,
  addNotificationToList,
} from './notificationSlice';

// Export thunks
export {
  fetchNotificationsForCompanion,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  archiveNotification,
  clearAllNotifications,
} from './thunks';

// Export selectors
export {
  selectNotificationsState,
  selectAllNotifications,
  selectNotificationsLoading,
  selectNotificationsError,
  selectUnreadCount,
  selectNotificationFilter,
  selectNotificationSortBy,
  selectHasHydratedCompanion,
  selectLastFetchTimestamp,
  selectNotificationsForCompanion,
  selectUnreadNotifications,
  selectReadNotifications,
  selectArchivedNotifications,
  selectNotificationsByCategory,
  selectHighPriorityNotifications,
  selectFilteredAndSortedNotifications,
  selectFilteredNotificationsForCompanion,
  selectSortedNotificationsForCompanion,
  selectUnreadCountByCategory,
  selectNotificationById,
  selectNotificationsGroupedByCategory,
  selectRecentNotifications,
  selectDisplayNotifications,
  selectUnreadUrgentNotifications,
} from './selectors';

// Export components
export {NotificationCard} from './components/NotificationCard/NotificationCard';
export {NotificationFilterPills} from './components/NotificationFilterPills/NotificationFilterPills';

// Export screens
export {NotificationsScreen} from './screens/NotificationsScreen/NotificationsScreen';

// Export mock data
export {mockNotifications} from './data/mockNotifications';
