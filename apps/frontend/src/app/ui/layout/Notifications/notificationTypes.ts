/** Tinted palette a notification row's icon disc + unread dot resolve to. */
export type NotificationTone = 'blue' | 'pink' | 'danger';

/** Icon keys mapped to react-icons/io5 glyphs in NotificationsPanel. */
export type NotificationIconKey = 'lab' | 'chat' | 'inventory' | 'appointment' | 'payout';

/**
 * A single notification row. `title` is the bold lead, `detail` the rest of the
 * primary line, `meta` the "2 min ago · Source" subline. `read: false` places
 * the row in the "Unread" group (with a coloured dot); `read: true` in "Earlier".
 */
export type NotificationItem = {
  id: string;
  tone: NotificationTone;
  icon: NotificationIconKey;
  title: string;
  detail: string;
  meta: string;
  read: boolean;
  /** Colour of the unread dot; defaults to `tone` when omitted. */
  dotTone?: NotificationTone;
};

/** Shape returned by the useNotifications presenter and consumed by the bell. */
export type NotificationsSnapshot = {
  items: NotificationItem[];
  unreadCount: number;
  /** True once a durable notifications source is wired; false = empty state only. */
  hasFeed: boolean;
  markAllRead: () => void;
};
