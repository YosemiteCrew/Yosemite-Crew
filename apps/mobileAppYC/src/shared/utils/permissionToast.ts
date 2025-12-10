import {Alert, Platform, ToastAndroid} from 'react-native';

/**
 * Display permission denied toast/alert
 * Uses platform-appropriate UI (Toast on Android, Alert on iOS)
 */
export const showPermissionDeniedToast = (label: string): void => {
  const message = `You don't have access to ${label}. Ask the primary parent to enable it.`;
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('Permission needed', message);
  }
};
