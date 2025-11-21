import {
  selectAllNotifications,
  selectNotificationsLoading,
  selectNotificationsError,
  selectUnreadCount,
  selectNotificationFilter,
  selectNotificationSortBy,
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
  selectHasHydratedCompanion,
  selectNotificationsState,
} from '@/features/notifications/selectors';
import { notificationsInitialState } from '@/features/notifications/notificationSlice';

const d1 = '2025-01-02T10:00:00Z';
const d2 = '2025-01-01T10:00:00Z';

const mockItems = [
  { id: '1', category: 'messages', status: 'unread', priority: 'high', timestamp: d1, companionId: 'c1' },
  { id: '2', category: 'appointments', status: 'read', priority: 'normal', timestamp: d2, companionId: 'c2' },
  { id: '3', category: 'health', status: 'archived', priority: 'urgent', timestamp: d2, companionId: 'c1' },
];

const mockState: any = {
  notifications: {
    items: mockItems,
    loading: false,
    error: 'Test Error',
    unreadCount: 5,
    filter: 'all',
    sortBy: 'new',
    lastFetchTimestamp: 123456789,
    hydratedCompanions: { 'c1': true, 'c2': false }
  },
};

describe('Notification Selectors', () => {

  it('selectNotificationsState returns default', () => {
    expect(selectNotificationsState({} as any)).toEqual(notificationsInitialState);
  });

  it('basic selectors', () => {
    expect(selectAllNotifications(mockState)).toEqual(mockItems);
    expect(selectNotificationsLoading(mockState)).toBe(false);
    expect(selectNotificationsError(mockState)).toBe('Test Error');
    expect(selectUnreadCount(mockState)).toBe(5);
    expect(selectNotificationFilter(mockState)).toBe('all');
    expect(selectNotificationSortBy(mockState)).toBe('new');
    expect(selectLastFetchTimestamp(mockState)).toBe(123456789);
  });

  it('companion selectors', () => {
    expect(selectNotificationsForCompanion('c1')(mockState)).toHaveLength(2);
    expect(selectNotificationsForCompanion(null)(mockState)).toEqual([]);
    expect(selectHasHydratedCompanion('c1')(mockState)).toBe(true);
    expect(selectHasHydratedCompanion('c2')(mockState)).toBe(false);
    expect(selectHasHydratedCompanion(null)(mockState)).toBe(false);
  });

  it('status & priority selectors', () => {
    expect(selectUnreadNotifications(mockState)).toHaveLength(1);
    expect(selectReadNotifications(mockState)).toHaveLength(1);
    expect(selectArchivedNotifications(mockState)).toHaveLength(1);
    expect(selectHighPriorityNotifications(mockState)).toHaveLength(2);

    // Test urgent unread
    const urgentState = {
        notifications: { ...mockState.notifications, items: [{...mockItems[0], priority: 'urgent'}] }
    };
    expect(selectUnreadUrgentNotifications(urgentState)).toHaveLength(1);
  });

  it('category selector', () => {
    expect(selectNotificationsByCategory('messages')(mockState)).toHaveLength(1);
    expect(selectNotificationsByCategory('all')(mockState)).toHaveLength(3);
  });

  // *** COVERAGE FOCUS: Sort/Filter Logic ***
  describe('selectFilteredAndSortedNotifications', () => {
      it('sortBy "new" (unread)', () => {
          const state = { notifications: { ...mockState.notifications, sortBy: 'new', filter: 'all' } };
          const res = selectFilteredAndSortedNotifications(state);
          expect(res).toHaveLength(1);
          expect(res[0].status).toBe('unread');
      });

      it('sortBy "seen" (read)', () => {
          const state = { notifications: { ...mockState.notifications, sortBy: 'seen', filter: 'all' } };
          const res = selectFilteredAndSortedNotifications(state);
          expect(res).toHaveLength(1);
          expect(res[0].status).toBe('read');
      });

      it('filter by category', () => {
          const state = { notifications: { ...mockState.notifications, filter: 'messages', sortBy: 'new' } };
          const res = selectFilteredAndSortedNotifications(state);
          expect(res).toHaveLength(1);
          expect(res[0].category).toBe('messages');
      });
  });

  // *** COVERAGE FOCUS: Companion Sort Logic ***
  describe('selectSortedNotificationsForCompanion', () => {
      it('sorts "new"', () => {
          const state = { notifications: { ...mockState.notifications, sortBy: 'new' } };
          const res = selectSortedNotificationsForCompanion('c1')(state);
          expect(res).toHaveLength(1);
          expect(res[0].status).toBe('unread');
      });

      it('sorts "seen"', () => {
          const state = { notifications: { ...mockState.notifications, sortBy: 'seen' } };
          const res = selectSortedNotificationsForCompanion('c2')(state);
          expect(res).toHaveLength(1);
          expect(res[0].status).toBe('read');
      });
  });

  describe('selectFilteredNotificationsForCompanion', () => {
      it('filter "all"', () => {
          const res = selectFilteredNotificationsForCompanion('c1')(mockState);
          expect(res).toHaveLength(2);
      });
      it('filter specific', () => {
          const state = { notifications: { ...mockState.notifications, filter: 'health' } };
          const res = selectFilteredNotificationsForCompanion('c1')(state);
          expect(res).toHaveLength(1);
          expect(res[0].category).toBe('health');
      });
  });

  describe('selectUnreadCountByCategory', () => {
      it('counts all', () => {
          expect(selectUnreadCountByCategory('all')(mockState)).toBe(1);
      });
      it('counts specific', () => {
          expect(selectUnreadCountByCategory('messages')(mockState)).toBe(1);
          expect(selectUnreadCountByCategory('health')(mockState)).toBe(0);
      });
  });

  describe('Utils', () => {
      it('groups by category', () => {
          const grp = selectNotificationsGroupedByCategory(mockState);
          expect(grp.messages).toHaveLength(1);
      });
      it('find by id', () => {
          expect(selectNotificationById('1')(mockState)).toBeDefined();
          expect(selectNotificationById('99')(mockState)).toBeUndefined();
      });
      it('recent', () => {
          expect(selectRecentNotifications(1)(mockState)).toHaveLength(1);
      });
      it('display', () => {
          const res = selectDisplayNotifications(mockState);
          expect(res.find(n => n.status === 'archived')).toBeUndefined();
      });
  });
});