# Firebase Cloud Messaging + Notifee Implementation Playbook

This document captures everything required to run the Yosemite Crew mobile push-notification stack end-to-end today, and what your backend teammates will need when the real service goes live.

---

## Quick Reference
- **Libraries**: `@react-native-firebase/app@23.5.0`, `@react-native-firebase/messaging@23.5.0`, `@notifee/react-native@9.1.8`
- **Android channel id**: `yc_general_notifications`
- **Deep-link scheme**: `yc://`
- **Key entry points**
  - JS bootstrap: `apps/mobileAppYC/App.tsx` (`<NotificationBootstrap />`)
  - Service implementation: `apps/mobileAppYC/src/shared/services/firebaseNotifications.ts`
  - Background handlers: `apps/mobileAppYC/index.js`
  - Android manifest updates: `apps/mobileAppYC/android/app/src/main/AndroidManifest.xml`
  - iOS AppDelegate: `apps/mobileAppYC/ios/mobileAppYC/AppDelegate.swift`

Run after pulling changes:

```bash
pnpm install
cd apps/mobileAppYC/ios && pod install && cd ..
```

---

## 1. Mobile App Configuration

### 1.1 Shared prerequisites
- Firebase project must already contain the iOS and Android apps (this project already uses Firebase for OAuth).
- Ensure **Cloud Messaging API (Legacy & HTTP v1)** is enabled in the Firebase console.
- Confirm the existing `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) files are up to date.
- Collect the **FCM server key** (for legacy API) and create a **service account** with the `Firebase Admin` role for HTTP v1 calls.

### 1.2 JavaScript bootstrap
- `initializeNotifications` handles:
  - Permission requests (API 33+ on Android + iOS alerts/badge/sound).
  - Channel creation (Android).
  - Background handlers (via Notifee + Firebase).
  - Foreground presentation + Redux feed updates.
  - Token management through the `onTokenUpdate` callback.
- The bootstrap wrapper (`NotificationBootstrap`) sits inside `App.tsx`, so initialization happens exactly once after the Redux store is ready. Navigation intents are queued until the `NavigationContainer` mounts.
- Background logic lives outside the component tree in `index.js`:

  ```ts
  messaging().setBackgroundMessageHandler(handleBackgroundRemoteMessage);
  notifee.onBackgroundEvent(handleNotificationBackgroundEvent);
  ```

### 1.3 Deep linking contract
- New scheme `yc://` is registered for both Android and iOS so links such as `yc://notifications` or `yc://tasks/task123` can be opened directly.
- `NotificationNavigationIntent` is derived from the message `data` payload. Supported keys:

| Key | Type | Notes |
| --- | --- | --- |
| `deepLink` | string | Highest priority – opened via `Linking.openURL`. |
| `navigationId` | enum | Maps to predefined destinations (see table below). |
| `root` | `'Main' \| 'Auth' \| 'Onboarding'` | Optional override for the root navigator. Defaults to `Main`. |
| `tab` | `'HomeStack' \| 'Appointments' \| 'Documents' \| 'Tasks'` | Explicit tab target. |
| `screen` | string | Final stack screen (e.g. `Notifications`, `TaskView`). |
| `params` | stringified JSON | Passed through to the target screen. |
| `category`, `priority`, `icon`, `avatarUrl`, `relatedId`, `relatedType` | Drive in-app list rendering and navigation context. |

Navigation helpers currently recognise these IDs:

| `navigationId` | Navigates to |
| --- | --- |
| `notifications` | Home tab → Notifications screen |
| `tasks` | Tasks tab → Tasks main dashboard |
| `task_detail` | Tasks tab → TaskView |
| `appointments` | Appointments tab → MyAppointments |
| `documents` | Documents tab → DocumentsMain |
| `home` | Home tab → Home screen |

### 1.4 Android specifics
- Manifest includes notification permissions (`POST_NOTIFICATIONS`, `WAKE_LOCK`, `RECEIVE`) and deep-link intent filter on `MainActivity`.
- Default channel + icon metadata configured inside `<application>`.
- `firebase.json` in repo root points RNFirebase to the custom channel and iOS foreground presentation options.
- Gradle includes the Firebase BOM and Messaging dependency.
- Ensure `google-services.json` sits at `apps/mobileAppYC/android/app/google-services.json`.

### 1.5 iOS specifics
- Capabilities enabled:
  - Push Notifications
  - Background Modes → `Remote notifications` & `Background fetch`
- Entitlements already include `aps-environment=development`; update to `production` before App Store builds.
- `AppDelegate.swift` now:
  - Sets `UNUserNotificationCenter.current().delegate`
  - Sets `Messaging.messaging().delegate`
  - Registers for remote notifications
  - Maps APNs token → FCM token
  - Presents foreground notifications (banner + list + sound + badge)
- **APNS Key onboarding** (if not yet done):
  1. Apple Developer Console → Keys → create key with APNs enabled.
  2. Download the `.p8`, note **Key ID** and **Team ID**.
  3. Firebase Console → Project settings → Cloud Messaging → iOS app → upload APNs key.
- `yc` URL scheme added to `Info.plist`.
- Run `pod install` after pulling dependencies.

---

## 2. Frontend Testing & Verification

### 2.1 On-device smoke checklist
1. Launch the app → system permission dialog should appear (iOS) or silent grant (Android < 13).
2. Inspect logs to confirm `FCM token updated ...` message.
3. Trigger a local reminder from any dev console (e.g. Reactotron) or a temporary button:

   ```ts
   import {scheduleLocalReminder} from '@/shared/services/firebaseNotifications';
   await scheduleLocalReminder(
     'Test Reminder',
     'This fired from Notifee after 1 minute',
     1,
     {navigationId: 'notifications'}
   );
   ```

4. Verify tapping the notification navigates to the expected screen and the in-app notification list updates instantly.

### 2.2 Firebase Console
1. Project → Cloud Messaging → Send your first message.
2. Add Title/Body; under **Additional options** → **Custom data** add e.g.
   - `navigationId`: `notifications`
   - `category`: `messages`
   - `priority`: `high`
3. Target your test device (using registration token).
4. Observe that the system tray entry appears even when the app is backgrounded or quit, and tapping opens the Notifications screen.

### 2.3 HTTP v1 / curl sample

```bash
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  https://fcm.googleapis.com/v1/projects/<your-project-id>/messages:send \
  -d '{
    "message": {
      "token": "<device-token>",
      "notification": {
        "title": "Yosemite update",
        "body": "Tap to review the latest appointment."
      },
      "data": {
        "navigationId": "appointments",
        "relatedType": "appointment",
        "relatedId": "apt_123",
        "category": "appointments",
        "priority": "high",
        "params": "{\"appointmentId\":\"apt_123\"}"
      },
      "android": {
        "priority": "HIGH"
      },
      "apns": {
        "headers": {
          "apns-push-type": "alert",
          "apns-priority": "10"
        },
        "payload": {
          "aps": {
            "content-available": 1,
            "mutable-content": 1
          }
        }
      }
    }
  }'
```

### 2.4 Debugging tips
- **Android**: `adb logcat ReactNativeJS:I ReactNative:I NOTIFEE:D *:S`
- **iOS**: Use Xcode → Devices & Simulators → view device logs filtered by `RNFB` or `NOTIFE`.
- `notifee.getTriggerNotificationIds()` and `notifee.getDisplayedNotifications()` are useful in debug builds to inspect active entries.

---

## 3. Backend Developer Checklist

### 3.1 Token lifecycle
- `initializeNotifications` calls `onTokenUpdate` for:
  - First-time registration.
  - Token refresh events.
- **Action items**:
  1. Provide an authenticated API endpoint: `POST /v1/me/push-tokens` `{ token, platform }`.
  2. Store multiple tokens per user/device (array semantics).
  3. On logout, call `messaging().deleteToken()` from the mobile app and invoke `DELETE /v1/me/push-tokens/{token}`.

### 3.2 Message payload structure
- All `data` values must be **strings** (FCM requirement).
- Recommended minimum fields:

| Field | Description |
| --- | --- |
| `navigationId` | Use table above to target in-app location. |
| `params` | JSON string for screen params (e.g. `{"taskId":"task_42"}`). |
| `category`, `priority` | Drive feed categorisation & styling. |
| `companionId` | Required to associate with the active pet profile (defaults to `'default-companion'` if omitted). |
| `relatedType`, `relatedId` | Helps analytics + navigation guardrails. |
| `deepLink` (optional) | Overrides navigation with a direct URI. |

### 3.3 Example Node.js sender

```ts
import admin, {messaging} from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccount.json')),
});

type YosemiteNotification = {
  tokens: string[];
  title: string;
  body: string;
  navigationId: string;
  params?: Record<string, unknown>;
  companionId: string;
};

export async function sendYosemiteNotification(input: YosemiteNotification) {
  const response = await messaging().sendEachForMulticast({
    tokens: input.tokens,
    notification: {
      title: input.title,
      body: input.body,
    },
    data: {
      navigationId: input.navigationId,
      params: JSON.stringify(input.params ?? {}),
      companionId: input.companionId,
      category: 'messages',
      priority: 'high',
    },
    android: {
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          'content-available': 1,
        },
      },
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
    },
  });

  console.log('Multicast send summary', response);
}
```

### 3.4 Topic & segment messaging
- Devices can subscribe to topics via `messaging().subscribeToTopic(topic)` on the app side.
- Keep topics generic (no PII). Example: `all-pet-parents`, `premium-users`, `city-san-francisco`.
- Backend APIs:

```ts
await messaging().subscribeToTopic(tokens, 'all-pet-parents');
await messaging().send({
  topic: 'all-pet-parents',
  notification: { title: 'Weekly tips', body: 'Your pet care digest is ready.' },
  data: { navigationId: 'home' },
});
```

---

## 4. Future Enhancements & Options

- **iOS notification service extension**: Needed to display rich media (images) inside alerts. Follow the RNFirebase guide to create a new target and call `Messaging.serviceExtension().populateNotificationContent(...)`.
- **Action buttons**: Notifee allows adding `pressAction` items (e.g. `Mark as read`). Extend the background event handler to call the relevant Redux action/API.
- **In-app preference screen**: `messaging().setAutoInitEnabled(false)` combined with the Notifee "Open Settings" handler allows fine-grained control for users who disable push permissions.
- **Analytics**: Add `analytics().logEvent('notification_open', { ... })` inside `navigateFromNotificationIntent` once the analytics module is enabled.

---

## 5. Support Matrix & Known Caveats

- **iOS simulator**: Push notifications require Apple Silicon + iOS 16+ simulator; otherwise test on a physical device.
- **Android 13+**: Users can still deny POST_NOTIFICATIONS. Check `await notifee.getNotificationSettings()` to guide users if necessary.
- **Background refresh (iOS)**: If the user disables Background App Refresh or Low Power Mode is active, background data-only messages may be throttled.
- **Notification delegation (Android Q+)**: React Native Firebase disables the Play Services delegation automatically. If re-enabled in `firebase.json`, JS listeners will not fire for delegated messages.

---

## 6. Change Log (This Iteration)

- Added Firebase Messaging + Notifee dependencies and bootstrap harness.
- Implemented unified notification service with foreground, background & deep-link handling.
- Registered background handlers in `index.js`.
- Added Android permissions, default channel metadata, and deep-link intent filter.
- Updated iOS AppDelegate with UNUserNotificationCenter + Messaging delegates and URL scheme.
- Created `firebase.json` for messaging defaults.
- Introduced helper APIs: `scheduleLocalReminder`, `clearAllSystemNotifications`, `getCurrentFcmToken`.
- Documented backend payload contract and testing workflows (this file).

---

Happy notifying 🚀
