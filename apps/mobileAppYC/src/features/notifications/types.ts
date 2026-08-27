// Notification types and interfaces
export type NotificationCategory =
  | 'all'
  | 'messages'
  | 'appointments'
  | 'tasks'
  | 'documents'
  | 'health'
  | 'dietary'
  | 'hygiene'
  | 'payment';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface Notification {
  id: string;
  companionId: string;
  title: string;
  description: string;
  category: NotificationCategory;
  icon: string; // Key from Images object
  avatarUrl?: string; // Profile image URL
  timestamp: string; // ISO datetime
  status: NotificationStatus;
  priority: NotificationPriority;
  deepLink?: string; // Navigation link
  relatedId?: string; // Task ID, Appointment ID, etc.
  relatedType?: 'task' | 'appointment' | 'document' | 'message' | 'payment';
  metadata?: Record<string, any>; // Additional data
}

export interface NotificationsState {
  items: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  hydratedCompanions: Record<string, boolean>;
  /**
   * Companions whose last list fetch FAILED, mapped to the message. Kept
   * apart from `hydratedCompanions` so a screen can tell a failed load
   * from an account that is genuinely empty - collapsing the two is what
   * made every failure render as the new-user empty state.
   */
  failedCompanions: Record<string, string>;
  /**
   * requestId of the newest in-flight fetch per companion. Lets a rejection
   * that arrives after a newer request already succeeded be discarded
   * instead of overwriting a good result with a stale error.
   */
  activeRequests: Record<string, string>;
  /**
   * Epoch ms of the last SUCCESSFUL fetch per companion, so a stale list can
   * say how old what the user is reading actually is.
   */
  lastLoadedAt: Record<string, number>;
  lastFetchTimestamp?: number;
  filter: NotificationCategory;
  sortBy: 'new' | 'seen';
}

export interface CreateNotificationPayload {
  companionId: string;
  title: string;
  description: string;
  category: NotificationCategory;
  icon: string;
  avatarUrl?: string;
  priority?: NotificationPriority;
  deepLink?: string;
  relatedId?: string;
  relatedType?: 'task' | 'appointment' | 'document' | 'message' | 'payment';
  metadata?: Record<string, any>;
}

export interface FirebaseNotificationPayload {
  title: string;
  body: string;
  data: {
    notificationId: string;
    companionId: string;
    category: NotificationCategory;
    relatedId?: string;
    relatedType?: string;
    deepLink?: string;
  };
  notification: {
    title: string;
    body: string;
  };
}
