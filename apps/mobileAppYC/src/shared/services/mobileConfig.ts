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
  console.log('[MobileConfig] Fetching config from', MOBILE_CONFIG_URL);
  const response = await axios.get<MobileConfig>(MOBILE_CONFIG_URL);
  console.log('[MobileConfig] Config response', response.status, response.data);
  return response.data;
};
