import axios from 'axios';

const MOBILE_CONFIG_URL = 'https://api.yosemitecrew.com/v1/mobile-config/';

export type MobileEnv =
  | 'dev'
  | 'development'
  | 'staging'
  | 'prod'
  | 'production';

export interface MobileConfig {
  env: MobileEnv;
  enablePayments: boolean;
  stripePublishableKey?: string;
  sentryDsn?: string;
  /**
   * Forces a 1px black outline on all liquid glass surfaces (cards/buttons) to aid visibility.
   */
  forceLiquidGlassBorder?: boolean | string;
  /**
   * Remote app-update policy controls.
   */
  appUpdate?: {
    enabled?: boolean | string;
    force?: boolean | string;
    title?: string;
    message?: string;
    minimumSupportedVersion?: string;
    minimumSupportedBuildNumber?: string | number;
    latestVersion?: string;
    latestBuildNumber?: string | number;
    remindAfterHours?: string | number;
    iosStoreUrl?: string;
    androidStoreUrl?: string;
    storeUrl?: string;
    appStoreId?: string;
    ios?: {
      enabled?: boolean | string;
      force?: boolean | string;
      title?: string;
      message?: string;
      minimumSupportedVersion?: string;
      minimumSupportedBuildNumber?: string | number;
      latestVersion?: string;
      latestBuildNumber?: string | number;
      remindAfterHours?: string | number;
      storeUrl?: string;
      appStoreId?: string;
    };
    android?: {
      enabled?: boolean | string;
      force?: boolean | string;
      title?: string;
      message?: string;
      minimumSupportedVersion?: string;
      minimumSupportedBuildNumber?: string | number;
      latestVersion?: string;
      latestBuildNumber?: string | number;
      remindAfterHours?: string | number;
      storeUrl?: string;
    };
  };
}

export const isProductionMobileEnv = (env?: MobileEnv | null): boolean => {
  if (!env) {
    return false;
  }
  const normalized = String(env).toLowerCase();
  return normalized === 'prod' || normalized === 'production';
};

export const isDevelopmentMobileEnv = (env?: MobileEnv | null): boolean => {
  if (!env) {
    return false;
  }
  const normalized = String(env).toLowerCase();
  return normalized === 'dev' || normalized === 'development';
};

export const fetchMobileConfig = async (): Promise<MobileConfig> => {
  console.log('[MobileConfig] Request', {url: MOBILE_CONFIG_URL});
  try {
    const response = await axios.get<MobileConfig>(MOBILE_CONFIG_URL);
    console.log('[MobileConfig] Response', {
      url: MOBILE_CONFIG_URL,
      status: response.status,
      data: response.data,
    });
    return response.data;
  } catch (error) {
    console.log('[MobileConfig] Error', {
      url: MOBILE_CONFIG_URL,
      error,
    });
    throw error;
  }
};
