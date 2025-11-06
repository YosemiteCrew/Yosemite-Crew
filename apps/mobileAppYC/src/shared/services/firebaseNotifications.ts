/**
 * Firebase Cloud Messaging Service
 * Handles push notifications and in-app notifications
 *
 * SETUP REQUIRED:
 * 1. Install firebase messaging:
 *    npm install @react-native-firebase/messaging
 *
 * 2. Update your google-services.json (Android) with Cloud Messaging API enabled
 *
 * 3. Configure APNs certificate in Firebase Console for iOS
 *
 * 4. Add these permissions to AndroidManifest.xml:
 *    <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
 *    <uses-permission android:name="android.permission.WAKE_LOCK" />
 *
 * 5. Add these to ios/Podfile:
 *    platform :ios, '11.0'  # Minimum required for FCM
 *    pod 'Firebase/Messaging'
 */

import messaging from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import type {AppDispatch} from '@/app/store';
import {createNotification} from '@/features/notifications';
import type {CreateNotificationPayload} from '@/features/notifications/types';

/**
 * Firebase Notifications Service
 * Handles all push notification functionality
 */
export class FirebaseNotificationsService {
  private initialized = false;
  private dispatch: AppDispatch | null = null;
  private remoteMessageListener: (() => void) | null = null;
  private notificationOpenedListener: (() => void) | null = null;
  private readonly backgroundMessageHandler: (() => Promise<void>) | null = null;

  /**
   * Initialize Firebase messaging
   * Call this in your app's main App component or after auth is established
   */
  async initialize(dispatch: AppDispatch): Promise<void> {
    if (this.initialized) {
      console.log('[FCM] Already initialized');
      return;
    }

    this.dispatch = dispatch;

    try {
      console.log('[FCM] Initializing Firebase Cloud Messaging');

      // Request user permission (iOS only requires explicit permission, Android is automatic)
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestUserPermission({
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        });

        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        console.log('[FCM] iOS notification permission:', {
          status: authStatus,
          enabled,
        });

        if (!enabled) {
          console.warn('[FCM] iOS notification permission denied');
          return;
        }
      }

      // Get FCM token for this device
      const token = await messaging().getToken();
      console.log('[FCM] Device token:', token);
      // NOTE: Send this token to your backend for device registration

      // Handle foreground messages
      this.setupForegroundMessageHandler();

      // Handle notification opened while app was in background
      this.setupBackgroundMessageHandler();

      // Handle initial notification if app was opened from notification
      this.handleInitialNotification();

      this.initialized = true;
      console.log('[FCM] Initialization complete');
    } catch (error) {
      console.error('[FCM] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup handler for messages received while app is in foreground
   */
  private setupForegroundMessageHandler(): void {
    this.remoteMessageListener = messaging().onMessage(async (remoteMessage: any) => {
      console.log('[FCM] Foreground message received:', remoteMessage);

      try {
        // Convert Firebase message to app notification
        const notification = this.convertFirebaseToNotification(remoteMessage);
        if (this.dispatch && notification) {
          this.dispatch(createNotification(notification) as any);
        }
      } catch (error) {
        console.error('[FCM] Error handling foreground message:', error);
      }
    });
  }

  /**
   * Setup handler for messages received while app is in background or terminated
   */
  private setupBackgroundMessageHandler(): void {
    // This handler is called when notification is tapped while app is in background
    this.notificationOpenedListener = messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('[FCM] Notification opened from background:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });
  }

  /**
   * Handle initial notification if app was opened from killed state
   */
  private async handleInitialNotification(): Promise<void> {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('[FCM] Initial notification (app killed):', remoteMessage);
        this.handleNotificationTap(remoteMessage);
      }
    } catch (error) {
      console.error('[FCM] Error getting initial notification:', error);
    }
  }

  /**
   * Set handler for messages received in background (Android only)
   * Must be set outside React component
   */
  static setBackgroundMessageHandler(handler: (message: any) => Promise<void>): void {
    messaging().setBackgroundMessageHandler(handler);
  }

  /**
   * Handle notification tap/click
   * Used for navigation and opening related screens
   */
  private handleNotificationTap(remoteMessage: any): void {
    console.log('[FCM] Notification tap handled');

    // Extract deep link from notification data
    const deepLink = remoteMessage?.data?.deepLink;

    // NOTE: Implement deep linking based on relatedType
    // Example:
    // if (relatedType === 'appointment') {
    //   navigation.navigate('Appointments', {screen: 'ViewAppointment', params: {appointmentId: relatedId}});
    // } else if (relatedType === 'task') {
    //   navigation.navigate('Tasks', {screen: 'TaskView', params: {taskId: relatedId}});
    // }

    if (deepLink) {
      console.log('[FCM] Would navigate to deeplink:', deepLink);
    }
  }

  /**
   * Convert Firebase RemoteMessage to app Notification format
   */
  private convertFirebaseToNotification(
    remoteMessage: any,
  ): CreateNotificationPayload | null {
    try {
      const {notification: notif, data} = remoteMessage;

      if (!notif || !data) {
        console.warn('[FCM] Message missing notification or data', remoteMessage);
        return null;
      }

      // Narrow relatedType safely to allowed values
      const rt = (data.relatedType as string | undefined) ?? undefined;
      const allowed = ['task', 'appointment', 'document', 'message', 'payment'] as const;
      const narrowedRelatedType = (allowed as readonly string[]).includes(rt || '')
        ? (rt as typeof allowed[number])
        : undefined;

      return {
        companionId: data.companionId || 'unknown',
        title: notif.title || 'Notification',
        description: notif.body || '',
        category: data.category || 'all',
        icon: data.icon || 'notificationIcon',
        priority: data.priority || 'medium',
        deepLink: data.deepLink,
        relatedId: data.relatedId,
        relatedType: narrowedRelatedType,
        avatarUrl: data.avatarUrl,
        metadata: {
          firebaseId: remoteMessage.messageId,
          timestamp: data.timestamp,
        },
      };
    } catch (error) {
      console.error('[FCM] Error converting Firebase message:', error);
      return null;
    }
  }

  /**
   * Send notification to FCM (from backend)
   * This is called by your backend API
   */
  static async sendNotificationFromBackend(params: {
    deviceToken: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    console.log('[FCM] Would send notification (backend only):', params);
  }

  /**
   * Subscribe to topic for broadcast notifications
   * Useful for notifications sent to all users
   */
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log('[FCM] Subscribed to topic:', topic);
    } catch (error) {
      console.error('[FCM] Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log('[FCM] Unsubscribed from topic:', topic);
    } catch (error) {
      console.error('[FCM] Error unsubscribing from topic:', error);
      throw error;
    }
  }

  /**
   * Get FCM token for device registration
   */
  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('[FCM] Token retrieved:', token);
      return token;
    } catch (error) {
      console.error('[FCM] Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Delete FCM token (useful on logout)
   */
  async deleteToken(): Promise<void> {
    try {
      await messaging().deleteToken();
      console.log('[FCM] Token deleted');
    } catch (error) {
      console.error('[FCM] Error deleting token:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  async isNotificationsEnabled(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const status = await messaging().hasPermission();
        return (
          status === messaging.AuthorizationStatus.AUTHORIZED ||
          status === messaging.AuthorizationStatus.PROVISIONAL
        );
      }
      return true; // Android always has permissions after system grants
    } catch (error) {
      console.error('[FCM] Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Request notification permissions (iOS)
   */
  async requestPermissions(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestUserPermission({
          alert: true,
          badge: true,
          sound: true,
        });
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        console.log('[FCM] Permission request result:', {enabled, authStatus});
      }
    } catch (error) {
      console.error('[FCM] Error requesting permissions:', error);
      throw error;
    }
  }

  /**
   * Cleanup listeners
   * Call this in your app's cleanup/logout flow
   */
  cleanup(): void {
    if (this.remoteMessageListener) {
      this.remoteMessageListener();
      this.remoteMessageListener = null;
    }
    if (this.notificationOpenedListener) {
      this.notificationOpenedListener();
      this.notificationOpenedListener = null;
    }
    this.initialized = false;
    this.dispatch = null;
    console.log('[FCM] Cleanup complete');
  }
}

// Singleton instance
export const firebaseNotificationsService = new FirebaseNotificationsService();

/**
 * LOCAL NOTIFICATION SERVICE
 * For showing in-app notifications (banners, toasts)
 * Can be combined with Firebase for local testing
 */
export class LocalNotificationService {
  /**
   * Show a local in-app notification
   * This can be triggered from Redux actions or Firebase messages
   */
  static showLocalNotification(params: {
    title: string;
    description: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number; // milliseconds
    onPress?: () => void;
  }): void {
    console.log('[LocalNotification]', params);
  }

  /**
   * Show local success notification
   */
  static showSuccess(title: string, description?: string): void {
    this.showLocalNotification({
      title,
      description: description || '',
      type: 'success',
      duration: 3000,
    });
  }

  /**
   * Show local error notification
   */
  static showError(title: string, description?: string): void {
    this.showLocalNotification({
      title,
      description: description || '',
      type: 'error',
      duration: 4000,
    });
  }

  /**
   * Show local warning notification
   */
  static showWarning(title: string, description?: string): void {
    this.showLocalNotification({
      title,
      description: description || '',
      type: 'warning',
      duration: 3000,
    });
  }

  /**
   * Show local info notification
   */
  static showInfo(title: string, description?: string): void {
    this.showLocalNotification({
      title,
      description: description || '',
      type: 'info',
      duration: 3000,
    });
  }
}
