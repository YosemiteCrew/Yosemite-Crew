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
  lastFetchTimestamp?: number;
  filter: NotificationCategory;
  sortBy: 'newest' | 'oldest' | 'priority';
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
