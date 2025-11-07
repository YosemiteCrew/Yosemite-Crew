/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import {
  handleBackgroundRemoteMessage,
  handleNotificationBackgroundEvent,
} from './src/shared/services/firebaseNotifications';

messaging().setBackgroundMessageHandler(handleBackgroundRemoteMessage);
notifee.onBackgroundEvent(handleNotificationBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
