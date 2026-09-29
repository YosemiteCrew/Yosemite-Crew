/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {getApps} from '@react-native-firebase/app';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import {
  handleBackgroundRemoteMessage,
  handleNotificationBackgroundEvent,
} from './src/shared/services/firebaseNotifications';

const defaultFirebaseApp = getApps().find(app => app.name === '[DEFAULT]');
if (defaultFirebaseApp) {
  setBackgroundMessageHandler(
    getMessaging(defaultFirebaseApp),
    handleBackgroundRemoteMessage,
  );
}
notifee.onBackgroundEvent(handleNotificationBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
