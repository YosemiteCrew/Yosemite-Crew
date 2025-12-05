import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';

import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens} from '@/features/auth/sessionManager';

const REGISTER_ENDPOINT = '/v1/device-token/register';
const UNREGISTER_ENDPOINT = '/v1/device-token/unregister';

let cachedIsEmulator: boolean | null = null;
let lastAccessToken: string | null = null;

const shouldSkipDeviceTokenCalls = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  if (cachedIsEmulator === null) {
    try {
      cachedIsEmulator = await DeviceInfo.isEmulator();
    } catch (error) {
      console.warn('[DeviceToken] Unable to determine simulator status', error);
      cachedIsEmulator = false;
    }
  }

  return cachedIsEmulator === true;
};

const buildAuthHeaders = async () => {
  const tokens = await getFreshStoredTokens();
  if (tokens?.accessToken) {
    lastAccessToken = tokens.accessToken;
    return withAuthHeaders(tokens.accessToken);
  }
  if (lastAccessToken) {
    return withAuthHeaders(lastAccessToken);
  }
  return undefined;
};

export const registerDeviceToken = async ({
  userId,
  token,
}: {
  userId?: string | null;
  token?: string | null;
}): Promise<void> => {
  if (!userId || !token) {
    return;
  }

  if (await shouldSkipDeviceTokenCalls()) {
    console.log('[DeviceToken] Skipping device token register on iOS simulator');
    return;
  }

  try {
    const headers = await buildAuthHeaders();
    await apiClient.post(
      REGISTER_ENDPOINT,
      {
        userId,
        deviceToken: token,
        platform: Platform.OS,
      },
      headers ? {headers} : undefined,
    );
  } catch (error) {
    console.warn('[DeviceToken] Failed to register device token', error);
  }
};

export const unregisterDeviceToken = async ({
  userId,
  token,
}: {
  userId?: string | null;
  token?: string | null;
}): Promise<void> => {
  if (!token) {
    return;
  }

  if (await shouldSkipDeviceTokenCalls()) {
    console.log('[DeviceToken] Skipping device token unregister on iOS simulator');
    return;
  }

  try {
    const headers = await buildAuthHeaders();
    await apiClient.post(
      UNREGISTER_ENDPOINT,
      {
        userId,
        deviceToken: token,
        platform: Platform.OS,
      },
      headers ? {headers} : undefined,
    );
  } catch (error) {
    console.warn('[DeviceToken] Failed to unregister device token', error);
  }
};

export const isRunningOnIosSimulator = shouldSkipDeviceTokenCalls;
