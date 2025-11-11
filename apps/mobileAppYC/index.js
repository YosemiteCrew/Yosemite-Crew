/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import {
  handleBackgroundRemoteMessage,
  handleNotificationBackgroundEvent,
} from './src/shared/services/firebaseNotifications';

const messagingInstance = getMessaging(getApp());

setBackgroundMessageHandler(messagingInstance, handleBackgroundRemoteMessage);
notifee.onBackgroundEvent(handleNotificationBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
