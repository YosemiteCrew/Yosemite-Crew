import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import type {
  Notification,
  NotificationCategory,
  NotificationPriority,
} from '../types';

const NOTIFICATIONS_ENDPOINT = '/v1/notification/mobile';

type MobileNotificationRecord = {
  id?: string;
  _id?: string;
  notificationId?: string;
  title?: string;
  heading?: string;
  description?: string;
  body?: string;
  message?: string;
  category?: string;
  type?: string;
  priority?: string;
  status?: string;
  state?: string;
  isSeen?: boolean;
  seen?: boolean;
  companionId?: string;
  petId?: string;
  ownerId?: string;
  userId?: string;
  relatedId?: string;
  entityId?: string;
  itemId?: string;
  relatedType?: string;
  link?: string;
  deepLink?: string;
  createdAt?: string;
  updatedAt?: string;
  timestamp?: string;
  sentAt?: string;
  icon?: string;
  avatarUrl?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const ALLOWED_CATEGORIES: NotificationCategory[] = [
  'all',
  'messages',
  'appointments',
  'tasks',
  'documents',
  'health',
  'dietary',
  'hygiene',
  'payment',
];

const ALLOWED_PRIORITIES: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];

const normalizeCategorySynonym = (raw?: string): NotificationCategory | null => {
  if (!raw) {
    return null;
  }

  const value = raw.toLowerCase();

  if (value === 'appointment' || value === 'appointments' || value === 'appts') {
    return 'appointments';
  }

  if (value === 'payment' || value === 'payments' || value === 'invoice' || value === 'billing') {
    return 'payment';
  }

  if (value === 'expense' || value === 'expenses') {
    return 'payment';
  }

  if (value === 'care' || value === 'health') {
    return 'health';
  }

  if (value === 'auth' || value === 'otp' || value === 'login') {
    return 'messages';
  }

  return null;
};

const buildAuthHeaders = async () => {
  const tokens = await getFreshStoredTokens();
  if (tokens?.accessToken) {
    return withAuthHeaders(tokens.accessToken);
  }
  return undefined;
};

const normalizeCategory = (raw?: string): NotificationCategory => {
  const candidate = (raw ?? '').toLowerCase();

  const synonym = normalizeCategorySynonym(candidate);
  if (synonym) {
    return synonym;
  }

  const match = ALLOWED_CATEGORIES.find(cat => cat === candidate);
  return match ?? 'all';
};

const normalizePriority = (raw?: string): NotificationPriority => {
  const candidate = (raw ?? '').toLowerCase();
  const match = ALLOWED_PRIORITIES.find(priority => priority === candidate);
  return match ?? 'medium';
};

const normalizeRelatedType = (
  raw?: string,
): Notification['relatedType'] => {
  if (!raw) {
    return undefined;
  }
  const candidate = raw.toLowerCase();
  if (candidate === 'appointment') {
    return 'appointment';
  }
  if (candidate === 'document') {
    return 'document';
  }
  if (candidate === 'task') {
    return 'task';
  }
  if (candidate === 'message') {
    return 'message';
  }
  if (candidate === 'payment' || candidate === 'invoice') {
    return 'payment';
  }
  return undefined;
};

const deriveStatus = (record: MobileNotificationRecord): Notification['status'] => {
  const normalized = (record.status ?? record.state ?? '').toLowerCase();
  if (normalized === 'read' || normalized === 'seen') {
    return 'read';
  }
  if (normalized === 'archived') {
    return 'archived';
  }

  // Fallback to explicit flags (API: isSeen/seen)
  if (record.isSeen || record.seen === true) {
    return 'read';
  }

  return 'unread';
};

const mapIconForCategory = (category: NotificationCategory): string => {
  switch (category) {
    case 'appointments':
      return 'calendarIcon';
    case 'documents':
      return 'documentIcon';
    case 'messages':
      return 'chatIcon';
    case 'tasks':
      return 'checkIcon';
    case 'health':
      return 'healthIcon';
    case 'dietary':
      return 'dietryIcon';
    case 'hygiene':
      return 'hygeineIcon';
    case 'payment':
      return 'walletIcon';
    default:
      return 'notificationIcon';
  }
};

const coerceIsoTimestamp = (value?: string): string => {
  if (value && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
};

const normalizeNotification = (
  record: MobileNotificationRecord,
  index: number,
): Notification => {
  const category = normalizeCategory(record.category ?? record.type);
  const priority = normalizePriority(record.priority);
  const status = deriveStatus(record);
  const timestamp =
    record.timestamp ?? record.createdAt ?? record.updatedAt ?? record.sentAt;

  const companionId =
    record.companionId ??
    record.petId ??
    record.ownerId ??
    record.userId ??
    'default-companion';

  return {
    id:
      record.id ??
      record.notificationId ??
      record._id ??
      `notif_${Date.now()}_${index}`,
    companionId,
    title: record.title ?? record.heading ?? 'Notification',
    description: record.description ?? record.body ?? record.message ?? '',
    category,
    icon: record.icon ?? mapIconForCategory(category),
    avatarUrl: record.avatarUrl ?? record.imageUrl,
    timestamp: coerceIsoTimestamp(timestamp),
    status,
    priority,
    deepLink: record.deepLink ?? record.link,
    relatedId: record.relatedId ?? record.entityId ?? record.itemId,
    relatedType: normalizeRelatedType(record.relatedType ?? record.type),
    metadata: record.metadata ?? record.data,
  };
};

const extractNotificationList = (payload: unknown): MobileNotificationRecord[] => {
  if (!payload) {
    return [];
  }
  const candidate = payload as any;
  if (Array.isArray(candidate?.data)) {
    return candidate.data;
  }
  if (Array.isArray(candidate?.notifications)) {
    return candidate.notifications;
  }
  if (Array.isArray(candidate?.items)) {
    return candidate.items;
  }
  if (Array.isArray(candidate)) {
    return candidate;
  }
  return [];
};

export const fetchMobileNotifications = async (): Promise<Notification[]> => {
  const headers = await buildAuthHeaders();
  const {data} = await apiClient.get(
    NOTIFICATIONS_ENDPOINT,
    headers ? {headers} : undefined,
  );

  const list = extractNotificationList(data);
  const normalized = list.map((record, index) =>
    normalizeNotification(record, index),
  );

  return normalized.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};

export const markMobileNotificationSeen = async (
  notificationId: string,
): Promise<void> => {
  if (!notificationId) {
    return;
  }

  const headers = await buildAuthHeaders();
  await apiClient.post(
    `${NOTIFICATIONS_ENDPOINT}/${notificationId}/seen`,
    undefined,
    headers ? {headers} : undefined,
  );
};
