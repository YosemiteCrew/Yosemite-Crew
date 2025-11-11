import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApp} from '@react-native-firebase/app';
import {
  getInitialNotification as getMessagingInitialNotification,
  getMessaging,
  getToken as getMessagingToken,
  isDeviceRegisteredForRemoteMessages,
  onMessage as onMessagingMessage,
  onTokenRefresh as onMessagingTokenRefresh,
  registerDeviceForRemoteMessages,
  setAutoInitEnabled as setMessagingAutoInitEnabled,
} from '@react-native-firebase/messaging';
import type {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  EventType,
  TimeUnit,
  TriggerType,
  type Event,
} from '@notifee/react-native';
import type {AppDispatch} from '@/app/store';
import {createNotification, addNotificationToList} from '@/features/notifications';
import type {
  CreateNotificationPayload,
  NotificationCategory,
  NotificationPriority,
} from '@/features/notifications/types';
import {PermissionsAndroid, Platform} from 'react-native';

const messagingInstance = getMessaging(getApp());

const ANDROID_CHANNEL_ID = 'yc_general_notifications';
const ANDROID_CHANNEL_NAME = 'Yosemite Crew';
const PENDING_INTENT_STORAGE_KEY = '@yc/pending-notification-intent';
const DEFAULT_FALLBACK_COMPANION_ID = 'default-companion';

type DataRecord = Record<string, string>;
type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

export type NotificationNavigationIntent = {
  root?: 'Main' | 'Auth' | 'Onboarding';
  tab?: 'HomeStack' | 'Appointments' | 'Documents' | 'Tasks';
  stackScreen?: string;
  params?: Record<string, unknown>;
  deepLink?: string;
};

type InitializeOptions = {
  dispatch: AppDispatch;
  onNavigate: (intent: NotificationNavigationIntent) => void;
  /**
   * Optional callback anytime a fresh FCM token is generated.
   * Useful for syncing to backend device registry.
   */
  onTokenUpdate?: (token: string) => Promise<void> | void;
};

let listenersConfigured = false;
let cachedDispatch: AppDispatch | null = null;
let navigationHandler: ((intent: NotificationNavigationIntent) => void) | null = null;
type AndroidNotificationConfig = NonNullable<
  Parameters<typeof notifee.displayNotification>[0]['android']
>;

/**
 * Initializes Firebase Cloud Messaging + Notifee orchestration.
 * Should be called once after Redux store and navigation are ready.
 */
export async function initializeNotifications(options: InitializeOptions): Promise<void> {
  if (listenersConfigured && cachedDispatch) {
    navigationHandler = options.onNavigate;
    cachedDispatch = options.dispatch;
    return;
  }

  cachedDispatch = options.dispatch;
  navigationHandler = options.onNavigate;

  await ensurePermissions();
  await ensureDeviceRegistration();
  await setMessagingAutoInitEnabled(messagingInstance, true);
  await ensureAndroidChannel();

  let initialToken: string | null = null;
  try {
    initialToken = await getMessagingToken(messagingInstance);
  } catch (error) {
    if (Platform.OS === 'ios') {
      console.warn(
        '[Notifications] Skipping initial FCM token fetch until APNs token is available (run on a physical device to enable push).',
        error,
      );
    } else {
      throw error;
    }
  }

  if (initialToken && options.onTokenUpdate) {
    await options.onTokenUpdate(initialToken);
  }

  onMessagingTokenRefresh(messagingInstance, async (newToken: string) => {
    if (options.onTokenUpdate) {
      await options.onTokenUpdate(newToken);
    }
  });

  onMessagingMessage(messagingInstance, async (remoteMessage: RemoteMessage) => {
    await handleRemoteMessage(remoteMessage, {source: 'foreground'});
  });

  notifee.onForegroundEvent(async event => {
    await handleNotifeeEvent(event);
  });

  await flushPendingNavigationIntent();

  const initialNotifee = await notifee.getInitialNotification();
  if (initialNotifee?.notification?.data) {
    processNavigationIntentFromData(normalizeDataRecord(initialNotifee.notification.data));
  } else {
    const initialMessaging = await getMessagingInitialNotification(messagingInstance);
    if (initialMessaging?.data) {
      processNavigationIntentFromData(normalizeDataRecord(initialMessaging.data));
    }
  }

  listenersConfigured = true;
}

export function areNotificationsInitialized(): boolean {
  return listenersConfigured;
}

/**
 * Background handler registered from native entry (index.js).
 */
export async function handleBackgroundRemoteMessage(
  remoteMessage: RemoteMessage,
): Promise<void> {
  await handleRemoteMessage(remoteMessage, {source: 'background'});
}

/**
 * Notifee background event handler registered from native entry (index.js).
 */
export async function handleNotificationBackgroundEvent(event: Event): Promise<void> {
  const {type, detail} = event;

  if (type === EventType.ACTION_PRESS && detail.pressAction?.id) {
    if (detail.pressAction.id === 'mark-as-read' && detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }

  if (
    type === EventType.PRESS &&
    detail.notification?.data &&
    Object.keys(detail.notification.data).length > 0
  ) {
    await storePendingNavigationIntent(normalizeDataRecord(detail.notification.data));
  }
}

async function ensurePermissions(): Promise<void> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (!hasPermission) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
  }

  const settings = await notifee.getNotificationSettings();

  if (
    settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED ||
    settings.authorizationStatus === AuthorizationStatus.DENIED
  ) {
    await notifee.requestPermission({
      alert: true,
      badge: true,
      sound: true,
      announcement: true,
    });
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const existing = await notifee.getChannel(ANDROID_CHANNEL_ID);
  if (existing) {
    return;
  }

  await notifee.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: ANDROID_CHANNEL_NAME,
    badge: true,
    importance: AndroidImportance.HIGH,
    lights: true,
    vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

async function handleRemoteMessage(
  remoteMessage: RemoteMessage,
  context: {source: 'foreground' | 'background'},
): Promise<void> {
  const notificationPayload = convertToNotificationPayload(remoteMessage);
  const data = normalizeDataRecord(remoteMessage.data);

  if (notificationPayload && cachedDispatch) {
    try {
      await (cachedDispatch(createNotification(notificationPayload) as any) as Promise<unknown>);
    } catch (error) {
      console.error('[firebaseNotifications] Failed to create notification', error);
      cachedDispatch(
        addNotificationToList({
          id: data.notificationId || `notif_${Date.now()}`,
          companionId: notificationPayload.companionId,
          title: notificationPayload.title,
          description: notificationPayload.description,
          category: notificationPayload.category,
          icon: notificationPayload.icon,
          avatarUrl: notificationPayload.avatarUrl,
          timestamp: new Date().toISOString(),
          status: 'unread',
          priority: notificationPayload.priority ?? 'medium',
          deepLink: notificationPayload.deepLink,
          relatedId: notificationPayload.relatedId,
          relatedType: notificationPayload.relatedType,
          metadata: notificationPayload.metadata,
        }),
      );
    }
  }

  const hasNativeNotificationPayload = Boolean(remoteMessage.notification);
  const shouldPresentNotifee =
    context.source === 'foreground' || !hasNativeNotificationPayload;

  if (shouldPresentNotifee) {
    await presentNotifeeNotification(remoteMessage);
  }

  if (context.source === 'background' && remoteMessage.data) {
    await storePendingNavigationIntent(normalizeDataRecord(remoteMessage.data));
  }
}

async function presentNotifeeNotification(remoteMessage: RemoteMessage): Promise<void> {
  const notification = remoteMessage.notification;
  const data = normalizeDataRecord(remoteMessage.data);

  const title = notification?.title ?? data.title ?? 'Yosemite Crew';
  const body = notification?.body ?? data.body ?? '';
  const imageUrl = notification?.android?.imageUrl || data.largeIcon;
  const smallIcon = normalizeAndroidIconResource(data.smallIcon) ?? 'ic_launcher';
  const largeIcon = normalizeAndroidIconResource(imageUrl ?? data.largeIcon);

  const androidConfig: AndroidNotificationConfig = {
    channelId: ANDROID_CHANNEL_ID,
    pressAction: {
      id: 'default',
    },
    smallIcon,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  };

  if (largeIcon) {
    androidConfig.largeIcon = largeIcon;
  }

  const notificationId = remoteMessage.messageId || `local_${Date.now()}`;

  await notifee.displayNotification({
    id: notificationId,
    title,
    body,
    data,
    android: androidConfig,
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
      categoryId: data.categoryId,
    },
  });
}

async function handleNotifeeEvent(event: Event): Promise<void> {
  const {type, detail} = event;

  switch (type) {
    case EventType.PRESS:
      if (detail.notification?.data) {
        processNavigationIntentFromData(normalizeDataRecord(detail.notification.data));
      }
      if (detail.notification?.id) {
        await notifee.cancelNotification(detail.notification.id);
      }
      break;
    case EventType.DISMISSED:
      if (detail.notification?.id) {
        await notifee.cancelNotification(detail.notification.id);
      }
      break;
    case EventType.ACTION_PRESS:
      if (detail.pressAction?.id === 'mark-as-read' && detail.notification?.data) {
        processNavigationIntentFromData(normalizeDataRecord(detail.notification.data));
      }
      break;
    default:
      break;
  }
}

function processNavigationIntentFromData(data: DataRecord): void {
  if (!navigationHandler) {
    storePendingNavigationIntent(data).catch(error => {
      console.warn('[Notifications] Failed to store navigation intent for later processing', error);
    });
    return;
  }

  const intent = buildNavigationIntent(data);
  if (intent) {
    navigationHandler(intent);
  }
}

function convertToNotificationPayload(remoteMessage: RemoteMessage): CreateNotificationPayload | null {
  const data = normalizeDataRecord(remoteMessage.data);
  const notification = remoteMessage.notification;

  const category = normalizeCategory(data.category);
  const priority = normalizePriority(data.priority);
  const companionId = data.companionId || data.ownerId || DEFAULT_FALLBACK_COMPANION_ID;

  if (!notification?.title && !data.title) {
    return null;
  }

  return {
    companionId,
    title: notification?.title ?? data.title ?? 'Notification',
    description: notification?.body ?? data.body ?? '',
    category,
    icon: data.icon || 'notificationIcon',
    avatarUrl: data.avatarUrl,
    priority,
    deepLink: data.deepLink,
    relatedId: data.relatedId,
    relatedType: normalizeRelatedType(data.relatedType),
    metadata: {
      firebaseMessageId: remoteMessage.messageId,
      sentAt: data.timestamp,
      ...extractMetadata(data),
    },
  };
}

function normalizeCategory(value?: string): NotificationCategory {
  const allowed: NotificationCategory[] = [
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

  if (value && (allowed as string[]).includes(value)) {
    return value as NotificationCategory;
  }

  return 'all';
}

function normalizePriority(value?: string): NotificationPriority | undefined {
  const allowed: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];
  if (value && (allowed as string[]).includes(value)) {
    return value as NotificationPriority;
  }
  return undefined;
}

function normalizeRelatedType(value?: string): CreateNotificationPayload['relatedType'] {
  const allowed = ['task', 'appointment', 'document', 'message', 'payment'] as const;
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as CreateNotificationPayload['relatedType'];
  }
  return undefined;
}

function normalizeAndroidIconResource(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();

  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('file://')) {
    return trimmed;
  }

  if (/^[a-z0-9_]+$/.test(lower)) {
    return lower;
  }

  return undefined;
}

function extractMetadata(data: DataRecord): Record<string, string | undefined> {
  const keys = ['navigationId', 'tab', 'screen', 'params', 'trackingId'];
  const aggregated: Record<string, string | undefined> = {};
  for (const key of keys) {
    if (data[key]) {
      aggregated[key] = data[key];
    }
  }
  return aggregated;
}

async function storePendingNavigationIntent(data: DataRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_INTENT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('[Notifications] Failed to persist navigation intent', error);
  }
}

async function flushPendingNavigationIntent(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_INTENT_STORAGE_KEY);
    if (!stored) {
      return;
    }
    await AsyncStorage.removeItem(PENDING_INTENT_STORAGE_KEY);

    const parsed = JSON.parse(stored) as DataRecord;
    processNavigationIntentFromData(parsed);
  } catch (error) {
    console.warn('[Notifications] Failed to read stored navigation intent', error);
  }
}

function buildNavigationIntent(data: DataRecord): NotificationNavigationIntent | null {
  const deepLink = data.deepLink ?? data.deeplink ?? data.url;
  const navigationId = data.navigationId;
  const root = (data.root as NotificationNavigationIntent['root']) ?? 'Main';
  const tab = data.tab as NotificationNavigationIntent['tab'];
  const screen = data.screen ?? mapNavigationIdToScreen(navigationId)?.screen;
  const inferredTab = tab ?? mapNavigationIdToScreen(navigationId)?.tab;

  let params: Record<string, unknown> | undefined;
  if (data.params) {
    try {
      params = JSON.parse(data.params);
    } catch {
      params = {value: data.params};
    }
  }

  if (deepLink) {
    return {deepLink, params};
  }

  if (!screen && !inferredTab) {
    return null;
  }

  return {
    root,
    tab: inferredTab,
    stackScreen: screen ?? 'Home',
    params,
  };
}

type NavigationRouteDescriptor = {
  tab: NotificationNavigationIntent['tab'];
  screen: string;
};

const NAVIGATION_LOOKUP: Record<string, NavigationRouteDescriptor> = {
  notifications: {tab: 'HomeStack', screen: 'Notifications'},
  tasks: {tab: 'Tasks', screen: 'TasksMain'},
  task_detail: {tab: 'Tasks', screen: 'TaskView'},
  appointments: {tab: 'Appointments', screen: 'MyAppointments'},
  documents: {tab: 'Documents', screen: 'DocumentsMain'},
  home: {tab: 'HomeStack', screen: 'Home'},
};

function mapNavigationIdToScreen(
  navigationId?: string,
): NavigationRouteDescriptor | undefined {
  if (!navigationId) {
    return undefined;
  }
  return NAVIGATION_LOOKUP[navigationId];
}

/**
 * Trigger a local scheduled reminder using Notifee.
 * Can be used for quick testing without backend.
 */
export async function scheduleLocalReminder(
  title: string,
  body: string,
  inMinutes: number,
  data: DataRecord = {},
): Promise<string> {
  await ensureAndroidChannel();

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + inMinutes * 60 * 1000,
    repeatFrequency: undefined,
    timeUnit: TimeUnit.MINUTES,
  } as const;

  return notifee.createTriggerNotification(
    {
      title,
      body,
      data,
      android: {
        channelId: ANDROID_CHANNEL_ID,
        pressAction: {id: 'default'},
      },
    },
    trigger,
  );
}

/**
 * Cancels all displayed notifications & removes any scheduled triggers.
 */
export async function clearAllSystemNotifications(): Promise<void> {
  await notifee.cancelAllNotifications();
  await notifee.cancelDisplayedNotifications();
}

/**
 * Access current device token; requires initializeNotifications to have run.
 */
export async function getCurrentFcmToken(): Promise<string | null> {
  try {
    await ensureDeviceRegistration();
    return await getMessagingToken(messagingInstance);
  } catch (error) {
    console.warn('[Notifications] Unable to fetch FCM token', error);
    return null;
  }
}

async function ensureDeviceRegistration(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!isDeviceRegisteredForRemoteMessages(messagingInstance)) {
    await registerDeviceForRemoteMessages(messagingInstance);
  }
}

function normalizeDataRecord(
  input?: Record<string, unknown> | null,
): DataRecord {
  if (!input) {
    return {};
  }

  const normalized: DataRecord = {};
  for (const [key, value] of Object.entries(input)) {
    normalized[key] = coerceToString(value);
  }
  return normalized;
}

function coerceToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
