import axios from 'axios';
import {
  MOBILE_CONFIG_PATH,
  PRODUCTION_API_BASE_URL,
  DEVELOPMENT_API_BASE_URL,
  MOBILE_CONFIG_BEHAVIOR,
  ENVIRONMENT_CONFIG,
} from '@/config/variables';

const MOBILE_CONFIG_TIMEOUT_MS = 8000;

const resolveMobileConfigUrl = (): string => {
  // Local override wins; otherwise appEnv picks prod vs dev endpoint
  if (MOBILE_CONFIG_BEHAVIOR.overrides?.mobileConfigUrl) {
    return MOBILE_CONFIG_BEHAVIOR.overrides.mobileConfigUrl;
  }
  const base =
    ENVIRONMENT_CONFIG.appEnv === 'production'
      ? PRODUCTION_API_BASE_URL
      : DEVELOPMENT_API_BASE_URL;
  return `${base}${MOBILE_CONFIG_PATH}`;
};

export type MobileEnv =
  | 'dev'
  | 'development'
  | 'staging'
  | 'prod'
  | 'production';

export interface MobileConfig {
  env: MobileEnv;
  enablePayments: boolean;
  /** When true, the review/demo bypass login is active for the test account. */
  enableReviewLogin?: boolean;
  stripePublishableKey?: string;
  stripePublishableKeyDev?: string;
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

export const fetchMobileConfig = async (
  url?: string,
): Promise<MobileConfig> => {
  const resolvedUrl = url ?? resolveMobileConfigUrl();
  console.log('[MobileConfig] Request', {url: resolvedUrl});
  try {
    const response = await axios.get<MobileConfig>(resolvedUrl, {
      timeout: MOBILE_CONFIG_TIMEOUT_MS,
    });
    console.log('[MobileConfig] Response', {
      url: resolvedUrl,
      status: response.status,
      data: response.data,
    });
    return response.data;
  } catch (error) {
    console.log('[MobileConfig] Error', {url: resolvedUrl, error});
    throw error;
  }
};
