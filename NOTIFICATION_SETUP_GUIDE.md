# Notification System Implementation Guide

## Overview

A complete notification module has been implemented for your Yosemite app with the following features:

- **Redux-based state management** with notifications slice, selectors, and thunks
- **Liquid glass notification cards** with swipe-to-dismiss animations
- **Category-based filtering** with color-coded pills matching appointment filters
- **Priority-based sorting** (Urgent, High, Medium, Low)
- **Firebase Cloud Messaging integration** ready for production
- **Mock data** for testing and development
- **Companion-based notification grouping**
- **Unread count tracking** with badge notifications
- **Animated interactions** - swipe right to dismiss, swipe left to archive

## File Structure

```
src/features/notifications/
├── notificationSlice.ts          # Redux slice with reducers
├── thunks.ts                     # Async actions
├── selectors.ts                  # Memoized selectors
├── types.ts                      # TypeScript interfaces
├── index.ts                      # Barrel exports
├── components/
│   ├── NotificationCard/         # Card component with swipe interactions
│   └── NotificationFilterPills/  # Filter selection UI
├── screens/
│   └── NotificationsScreen/      # Main notifications screen
└── data/
    └── mockNotifications.ts      # Sample notification data
```

## Current Features

### ✅ Implemented

1. **State Management**
   - Redux slice with notifications, filter, and sort state
   - Thunks for CRUD operations (fetch, create, read, delete, archive)
   - Comprehensive selectors for filtering and sorting

2. **UI Components**
   - NotificationCard with liquid glass styling
   - Swipe-to-dismiss animation (right swipe)
   - Swipe-to-archive animation (left swipe)
   - Real-time unread count
   - Category badges and time formatting

3. **Notifications Screen**
   - Header with unread badge
   - Filter pills by category
   - Sort options (Newest, Oldest, Priority)
   - Mark all as read button
   - Clear all notifications button
   - Pull-to-refresh functionality
   - Empty state messaging

4. **Integration**
   - Added to navigation stack (HomeStack)
   - Notification icon in HomeScreen triggers navigation
   - Connected to Redux store with persistence
   - Mock data for development

## 🚀 Firebase Cloud Messaging Setup (Step-by-Step)

### Step 1: Install Firebase Messaging Package

```bash
npm install @react-native-firebase/messaging
# or
yarn add @react-native-firebase/messaging

# Then pod install for iOS
cd ios && pod install && cd ..
```

### Step 2: Configure Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your Yosemite project
3. Enable **Cloud Messaging** API
4. For **Android**:
   - Download `google-services.json`
   - Ensure `Services > Cloud Messaging` is enabled
5. For **iOS**:
   - Upload APNs certificate under Project Settings > Cloud Messaging
   - Download APNs key from Apple Developer

### Step 3: Update Android Configuration

**android/app/build.gradle**:
```gradle
// Add at the top of apply plugins section
apply plugin: 'com.google.gms.google-services'

// Add to dependencies
dependencies {
    implementation 'com.google.firebase:firebase-bom:32.x.x'  // Use latest version
    implementation 'com.google.firebase:firebase-messaging'
}
```

**android/build.gradle**:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.x'  // Update to latest
    }
}
```

**AndroidManifest.xml**:
```xml
<manifest>
    <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application>
        <!-- Existing config -->

        <!-- Firebase Services -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

### Step 4: Update iOS Configuration

**ios/Podfile**:
```ruby
target 'YosemiteMobileApp' do
  platform :ios, '11.0'  # Minimum required for FCM

  # ... other pods ...

  pod 'Firebase/Messaging'

  post_install do |installer|
    react_native_post_install(installer)
  end
end
```

**ios/YosemiteMobileApp/AppDelegate.mm** (for Objective-C++):
```objc
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

  // Initialize Firebase
  [FIRApp configure];

  // ... rest of setup ...

  return YES;
}
```

### Step 5: Initialize Firebase Notifications in Your App

**src/app/index.tsx** or **App.tsx**:

```typescript
import {useEffect} from 'react';
import {useAppDispatch} from '@/app/hooks';
import {firebaseNotificationsService} from '@/shared/services/firebaseNotifications';

// In your main App component or initialization code:
export function AppInitialization() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Initialize after app is ready and auth is established
    const initializeNotifications = async () => {
      try {
        await firebaseNotificationsService.initialize(dispatch);
        console.log('Firebase notifications initialized');
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Cleanup on unmount
    return () => {
      firebaseNotificationsService.cleanup();
    };
  }, [dispatch]);

  return null;
}
```

### Step 6: Setup Background Message Handler

For handling notifications when app is killed/in background:

**src/index.ts** or **index.js** (entry point):

```typescript
import {firebaseNotificationsService} from '@/shared/services/firebaseNotifications';
import {store} from '@/app/store';

// Set background message handler (must be outside component)
firebaseNotificationsService.constructor.setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background notification received:', remoteMessage);

  // Handle notification in background
  // This won't have Redux dispatch access, so persist to storage if needed
  // Or wait for app to become active
});
```

## 🔔 Sending Notifications from Backend

### Firebase Admin SDK (Node.js Backend)

```typescript
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Send to specific device
async function sendNotificationToDevice(deviceToken: string) {
  const message = {
    notification: {
      title: 'Medication Time!',
      body: 'Time for Oscar\'s daily medication.',
    },
    data: {
      companionId: 'companion_1',
      category: 'health',
      icon: 'syringeIcon',
      priority: 'high',
      relatedType: 'task',
      relatedId: 'task_123',
      deepLink: '/tasks/task_123',
      timestamp: new Date().toISOString(),
    },
    token: deviceToken,
  };

  const response = await admin.messaging().send(message);
  console.log('Notification sent:', response);
}

// Send to topic (broadcast)
async function sendNotificationToTopic(topic: string) {
  const message = {
    notification: {
      title: 'New Feature Available',
      body: 'Check out our new observational tools!',
    },
    data: {
      category: 'messages',
      deepLink: '/home',
    },
    topic: topic,
  };

  const response = await admin.messaging().send(message);
  console.log('Topic notification sent:', response);
}

// Send multicast (multiple devices)
async function sendMulticastNotification(deviceTokens: string[]) {
  const message = {
    notification: {
      title: 'Vaccination Reminder',
      body: 'Your companion\'s vaccination is due this week.',
    },
    data: {
      companionId: 'companion_1',
      category: 'health',
      relatedType: 'task',
    },
  };

  const response = await admin.messaging().sendMulticast({
    ...message,
    tokens: deviceTokens,
  });

  console.log('Multicast sent:', response);
}
```

### REST API for Sending Notifications

You can also send notifications via REST API:

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Content-Type: application/json" \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -d '{
    "notification": {
      "title": "Appointment Confirmed",
      "body": "Your appointment is confirmed for tomorrow."
    },
    "data": {
      "companionId": "companion_1",
      "category": "appointments",
      "relatedId": "apt_123",
      "relatedType": "appointment"
    },
    "to": "DEVICE_TOKEN_HERE"
  }'
```

## 📱 In-App Notifications (Optional Enhancement)

For toast/banner notifications while app is active:

```bash
npm install react-native-toast-message
```

**App.tsx**:
```typescript
import Toast from 'react-native-toast-message';

export default function App() {
  return (
    <>
      <RootNavigator />
      <Toast />
    </>
  );
}
```

## 🎯 Integrating with Your Features

### Example 1: Send Task Reminder Notification

When a task is created with a reminder:

```typescript
// In your backend API when creating a task
async function createTaskWithReminder(userId: string, task: Task) {
  // Save task to database
  const savedTask = await db.tasks.create(task);

  // Get user's FCM token
  const user = await db.users.findById(userId);

  if (user.fcmToken) {
    // Schedule notification (use a job queue like Bull or Firebase Scheduled Functions)
    await scheduleNotification({
      deviceToken: user.fcmToken,
      title: task.title,
      body: `Reminder: ${task.description}`,
      scheduledTime: task.reminderTime,
      data: {
        companionId: task.companionId,
        category: 'health',
        relatedType: 'task',
        relatedId: savedTask.id,
      },
    });
  }
}
```

### Example 2: Send Appointment Confirmation

```typescript
// When appointment is booked
async function confirmAppointment(appointmentId: string) {
  const appointment = await db.appointments.findById(appointmentId);
  const user = await db.users.findById(appointment.userId);

  if (user.fcmToken) {
    await firebaseAdmin.messaging().send({
      notification: {
        title: 'Appointment Confirmed',
        body: `Your appointment with ${appointment.businessName} is confirmed.`,
      },
      data: {
        companionId: appointment.companionId,
        category: 'appointments',
        relatedType: 'appointment',
        relatedId: appointmentId,
      },
      token: user.fcmToken,
    });
  }
}
```

### Example 3: Co-Parent Notification

```typescript
// When co-parent request is sent
async function sendCoParentRequest(fromUserId: string, toUserId: string) {
  const fromUser = await db.users.findById(fromUserId);
  const toUser = await db.users.findById(toUserId);

  if (toUser.fcmToken) {
    await firebaseAdmin.messaging().send({
      notification: {
        title: 'Co-Parent Request',
        body: `${fromUser.firstName} sent you a co-parent request.`,
      },
      data: {
        companionId: companionId,
        category: 'messages',
        relatedType: 'message',
        deepLink: '/coparents',
      },
      token: toUser.fcmToken,
    });
  }
}
```

## 🧪 Testing Notifications

### Test with Firebase Console

1. Go to Firebase Console > Cloud Messaging
2. Click "Send your first message"
3. Create test notification with:
   ```json
   {
     "title": "Test Notification",
     "body": "This is a test"
   }
   ```
4. Select your app and send

### Test Locally (Development)

Use mock data from `mockNotifications.ts`:

```typescript
import {mockNotifications} from '@/features/notifications';

// In your component or thunk
dispatch(injectMockNotifications(mockNotifications));
```

### Test with Firebase Emulator

```bash
# Start emulator (requires Firebase CLI)
firebase emulators:start

# Configure your app to use emulator
messaging().useEmulator('localhost', 9299);
```

## 📊 Notification Analytics

Track notification engagement:

```typescript
import analytics from '@react-native-firebase/analytics';

// Track notification opened
const handleNotificationTap = async (notification: Notification) => {
  await analytics().logEvent('notification_opened', {
    notification_id: notification.id,
    category: notification.category,
    priority: notification.priority,
  });
};

// Track notification action
const handleDismiss = async (notification: Notification) => {
  await analytics().logEvent('notification_dismissed', {
    notification_id: notification.id,
    time_displayed_ms: timeSinceReceived,
  });
};
```

## 🔒 Security Considerations

1. **Validate FCM Token**: Always validate device tokens on backend before storing
2. **Encrypt Sensitive Data**: Don't send sensitive data in notification payload
3. **Rate Limiting**: Implement rate limiting to prevent notification spam
4. **User Preferences**: Always respect notification preferences/settings
5. **GDPR Compliance**: Get explicit consent for notifications
6. **Token Rotation**: Rotate FCM tokens periodically
7. **Verify Requests**: Use Firebase auth to verify notification requests

## ⚙️ Redux Integration Summary

The notification system is fully integrated with Redux:

```typescript
// Access notifications in any component
import {useSelector, useDispatch} from 'react-redux';
import {
  selectDisplayNotifications,
  selectUnreadCount,
  markNotificationAsRead,
  archiveNotification,
} from '@/features/notifications';

function MyComponent() {
  const dispatch = useDispatch();
  const notifications = useSelector(selectDisplayNotifications);
  const unreadCount = useSelector(selectUnreadCount);

  return (
    <View>
      <Text>Unread: {unreadCount}</Text>
      {notifications.map(notif => (
        <NotificationCard
          key={notif.id}
          notification={notif}
          onPress={() => dispatch(markNotificationAsRead({notificationId: notif.id}))}
        />
      ))}
    </View>
  );
}
```

## 📝 API Reference

### Redux Selectors

```typescript
selectAllNotifications                       // All notifications
selectUnreadCount                           // Count of unread
selectUnreadNotifications                   // Unread only
selectNotificationsByCategory(category)     // Filtered by category
selectHighPriorityNotifications              // Urgent + high priority
selectFilteredAndSortedNotifications         // With current filter/sort
selectRecentNotifications(limit)             // Last N notifications
selectDisplayNotifications                  // Ready to display (not archived)
selectNotificationById(id)                   // Single notification
```

### Thunks

```typescript
fetchNotificationsForCompanion({companionId})
createNotification(payload)
markNotificationAsRead({notificationId})
markAllNotificationsAsRead({companionId})
deleteNotification({notificationId})
archiveNotification({notificationId})
clearAllNotifications()
```

### Actions

```typescript
setNotificationFilter(category)    // Change category filter
setSortBy(sortBy)                 // Change sort order
injectMockNotifications(array)     // For testing
addNotificationToList(notification) // Add single notification
```

## 🐛 Troubleshooting

### Issue: FCM Token Not Generated

**Solution**: Ensure firebase.json exists and has correct project ID:
```json
{
  "project_id": "your-firebase-project-id"
}
```

### Issue: Notifications Not Received on Android

**Solution**: Check:
1. Google Play Services installed
2. `google-services.json` in android/app/
3. Cloud Messaging API enabled in Firebase Console

### Issue: Notifications Not Received on iOS

**Solution**: Check:
1. APNs certificate uploaded to Firebase
2. Platform.OS === 'ios' permission handling
3. Dev/Prod certificates match

### Issue: Background Messages Not Handled

**Solution**: Ensure background message handler is set before app starts (in index.ts, not in component)

## 🎉 Future Enhancements

- [ ] Rich media notifications (images, videos)
- [ ] Action buttons in notifications
- [ ] Notification scheduling
- [ ] A/B testing notifications
- [ ] Notification analytics dashboard
- [ ] User notification preferences UI
- [ ] Silent notifications for background sync
- [ ] Notification grouping/bundling

## 📚 Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase Docs](https://rnfirebase.io/messaging/usage)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [APNs Setup Guide](https://firebase.google.com/docs/cloud-messaging/ios/certs)
