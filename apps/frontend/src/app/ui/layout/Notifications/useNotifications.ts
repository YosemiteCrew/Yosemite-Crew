'use client';

import { useMemo } from 'react';
import type { NotificationsSnapshot } from './notificationTypes';

/**
 * Presenter for the header notifications bell.
 *
 * The PIMS has no durable notifications feed yet (the only notification-adjacent
 * signal, `useChatNotifications`, is transient browser push, not a readable
 * list). Rather than fabricate a feed, this presenter reports an EMPTY feed so
 * the panel renders the "All caught up" state and the bell shows no unread dot.
 *
 * When a real source lands, populate `items` / `unreadCount` here and implement
 * `markAllRead` against it — the panel and bell already render every row type,
 * the header count, and mark-all-read from this shape.
 */
export function useNotifications(): NotificationsSnapshot {
  return useMemo<NotificationsSnapshot>(
    () => ({
      items: [],
      unreadCount: 0,
      hasFeed: false,
      markAllRead: () => {},
    }),
    []
  );
}

export default useNotifications;
