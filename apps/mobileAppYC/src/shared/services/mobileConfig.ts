import client from './apiClient';

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
}

export const isProductionMobileEnv = (env?: MobileEnv | string | null): boolean => {
  if (!env) {
    return false;
  }
  const normalized = String(env).toLowerCase();
  return normalized === 'prod' || normalized === 'production';
};

export const fetchMobileConfig = async (): Promise<MobileConfig> => {
  const response = await client.get<MobileConfig>('/v1/mobile-config/');
  return response.data;
};
