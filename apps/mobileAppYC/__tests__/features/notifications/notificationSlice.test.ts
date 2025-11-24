import notificationReducer, {
  setNotificationFilter,
  setSortBy,
  clearNotificationError,
  resetNotificationState,
  injectMockNotifications,
  addNotificationToList,
  notificationsInitialState,
} from '@/features/notifications/notificationSlice';
import {
  fetchNotificationsForCompanion,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  archiveNotification,
  clearAllNotifications,
} from '@/features/notifications/thunks';

describe('notificationSlice', () => {
  let initialState: any;

  beforeEach(() => {
    initialState = JSON.parse(JSON.stringify(notificationsInitialState));
  });

  // =========================================
  // Synchronous Reducers
  // =========================================

  it('should return initial state', () => {
    expect(notificationReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle setNotificationFilter', () => {
    const state = notificationReducer(initialState, setNotificationFilter('health'));
    expect(state.filter).toBe('health');
  });

  it('should handle setSortBy', () => {
    const state = notificationReducer(initialState, setSortBy('seen'));
    expect(state.sortBy).toBe('seen');
  });

  it('should handle clearNotificationError', () => {
    initialState.error = 'err';
    const state = notificationReducer(initialState, clearNotificationError());
    expect(state.error).toBeNull();
  });

  it('should handle resetNotificationState', () => {
    initialState.unreadCount = 5;
    const state = notificationReducer(initialState, resetNotificationState());
    expect(state).toEqual(notificationsInitialState);
  });

  it('should handle injectMockNotifications', () => {
    const mocks: any = [{ id: '1', status: 'unread' }, { id: '2', status: 'read' }];
    const state = notificationReducer(initialState, injectMockNotifications(mocks));
    expect(state.items).toEqual(mocks);
    expect(state.unreadCount).toBe(1); // Only counts 'unread'
  });

  describe('addNotificationToList', () => {
    it('increments count if unread', () => {
      const notif: any = { id: '1', status: 'unread' };
      const state = notificationReducer(initialState, addNotificationToList(notif));
      expect(state.items).toContainEqual(notif);
      expect(state.unreadCount).toBe(1);
    });

    it('does not increment count if read', () => {
      const notif: any = { id: '1', status: 'read' };
      const state = notificationReducer(initialState, addNotificationToList(notif));
      expect(state.unreadCount).toBe(0);
    });
  });

  // =========================================
  // Async Thunks (Extra Reducers)
  // =========================================

  describe('fetchNotificationsForCompanion', () => {
    it('pending', () => {
      const state = notificationReducer(initialState, { type: fetchNotificationsForCompanion.pending.type });
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('fulfilled', () => {
      const payload = {
        companionId: 'c1',
        notifications: [{ id: '1', status: 'unread' }, { id: '2', status: 'read' }],
      };
      const action = { type: fetchNotificationsForCompanion.fulfilled.type, payload };
      const state = notificationReducer(initialState, action as any);

      expect(state.loading).toBe(false);
      expect(state.items).toHaveLength(2);
      expect(state.unreadCount).toBe(1);
      expect(state.hydratedCompanions['c1']).toBe(true);
      expect(state.lastFetchTimestamp).toBeDefined();
    });

    it('rejected', () => {
      const action = { type: fetchNotificationsForCompanion.rejected.type, payload: 'Error' };
      const state = notificationReducer(initialState, action as any);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Error');
    });

    it('rejected (default error)', () => {
        const action = { type: fetchNotificationsForCompanion.rejected.type, payload: undefined };
        const state = notificationReducer(initialState, action as any);
        expect(state.error).toBe('Failed to fetch notifications');
    });
  });

  describe('createNotification', () => {
    it('pending', () => {
      const state = notificationReducer(initialState, { type: createNotification.pending.type });
      expect(state.loading).toBe(true);
    });

    it('fulfilled (unread)', () => {
      const payload = { id: '1', status: 'unread' };
      const action = { type: createNotification.fulfilled.type, payload };
      const state = notificationReducer(initialState, action as any);
      expect(state.items[0]).toEqual(payload);
      expect(state.unreadCount).toBe(1);
    });

    it('fulfilled (read)', () => {
      const payload = { id: '1', status: 'read' };
      const action = { type: createNotification.fulfilled.type, payload };
      const state = notificationReducer(initialState, action as any);
      expect(state.unreadCount).toBe(0);
    });

    it('rejected', () => {
      const state = notificationReducer(initialState, { type: createNotification.rejected.type });
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Failed to create notification');
    });
  });

  describe('markNotificationAsRead', () => {
    it('fulfilled - updates unread to read', () => {
      initialState.items = [{ id: '1', status: 'unread' }];
      initialState.unreadCount = 1;
      const action = { type: markNotificationAsRead.fulfilled.type, payload: { notificationId: '1' } };
      const state = notificationReducer(initialState, action as any);
      expect(state.items[0].status).toBe('read');
      expect(state.unreadCount).toBe(0);
    });

    it('fulfilled - ignores already read item', () => {
      initialState.items = [{ id: '1', status: 'read' }];
      initialState.unreadCount = 10; // should not change
      const action = { type: markNotificationAsRead.fulfilled.type, payload: { notificationId: '1' } };
      const state = notificationReducer(initialState, action as any);
      expect(state.unreadCount).toBe(10);
    });

    it('fulfilled - ignores missing item', () => {
        const action = { type: markNotificationAsRead.fulfilled.type, payload: { notificationId: '999' } };
        const state = notificationReducer(initialState, action as any);
        expect(state.unreadCount).toBe(0);
    });

    it('rejected', () => {
       const state = notificationReducer(initialState, { type: markNotificationAsRead.rejected.type });
       expect(state.error).toBe('Failed to mark notification as read');
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('fulfilled - marks all unread as read', () => {
      initialState.items = [{ id: '1', status: 'unread' }, { id: '2', status: 'read' }];
      initialState.unreadCount = 1;
      const action = { type: markAllNotificationsAsRead.fulfilled.type };
      const state = notificationReducer(initialState, action as any);
      expect(state.items[0].status).toBe('read');
      expect(state.unreadCount).toBe(0);
    });

    it('rejected', () => {
        const state = notificationReducer(initialState, { type: markAllNotificationsAsRead.rejected.type });
        expect(state.error).toBe('Failed to mark notifications as read');
    });
  });

  describe('deleteNotification', () => {
    it('fulfilled - deletes unread (decrements count)', () => {
      initialState.items = [{ id: '1', status: 'unread' }];
      initialState.unreadCount = 1;
      const action = { type: deleteNotification.fulfilled.type, payload: { notificationId: '1' } };
      const state = notificationReducer(initialState, action as any);
      expect(state.items).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('fulfilled - deletes read (count stays)', () => {
      initialState.items = [{ id: '1', status: 'read' }];
      initialState.unreadCount = 5;
      const action = { type: deleteNotification.fulfilled.type, payload: { notificationId: '1' } };
      const state = notificationReducer(initialState, action as any);
      expect(state.items).toHaveLength(0);
      expect(state.unreadCount).toBe(5);
    });

    it('fulfilled - item missing', () => {
        initialState.items = [{ id: '1', status: 'read' }];
        const action = { type: deleteNotification.fulfilled.type, payload: { notificationId: '999' } };
        const state = notificationReducer(initialState, action as any);
        expect(state.items).toHaveLength(1);
    });

    it('rejected', () => {
        const state = notificationReducer(initialState, { type: deleteNotification.rejected.type });
        expect(state.error).toBe('Failed to delete notification');
    });
  });

  describe('archiveNotification', () => {
    it('fulfilled - archives unread (decrements count)', () => {
        initialState.items = [{ id: '1', status: 'unread' }];
        initialState.unreadCount = 1;
        const action = { type: archiveNotification.fulfilled.type, payload: { notificationId: '1' } };
        const state = notificationReducer(initialState, action as any);
        expect(state.items[0].status).toBe('archived');
        expect(state.unreadCount).toBe(0);
    });

    it('fulfilled - archives read (count stays)', () => {
        initialState.items = [{ id: '1', status: 'read' }];
        initialState.unreadCount = 5;
        const action = { type: archiveNotification.fulfilled.type, payload: { notificationId: '1' } };
        const state = notificationReducer(initialState, action as any);
        expect(state.items[0].status).toBe('archived');
        expect(state.unreadCount).toBe(5);
    });

    it('fulfilled - missing item', () => {
        const action = { type: archiveNotification.fulfilled.type, payload: { notificationId: '999' } };
        const state = notificationReducer(initialState, action as any);
        expect(state.error).toBeNull();
    });

    it('rejected', () => {
        const state = notificationReducer(initialState, { type: archiveNotification.rejected.type });
        expect(state.error).toBe('Failed to archive notification');
    });
  });

  describe('clearAllNotifications', () => {
      it('fulfilled - keeps only archived, resets count', () => {
          initialState.items = [
              { id: '1', status: 'unread' },
              { id: '2', status: 'archived' }
          ];
          initialState.unreadCount = 1;
          const action = { type: clearAllNotifications.fulfilled.type };
          const state = notificationReducer(initialState, action as any);
          expect(state.items).toHaveLength(1);
          expect(state.items[0].status).toBe('archived');
          expect(state.unreadCount).toBe(0);
      });

      it('rejected', () => {
        const state = notificationReducer(initialState, { type: clearAllNotifications.rejected.type });
        expect(state.error).toBe('Failed to clear notifications');
      });
  });
});