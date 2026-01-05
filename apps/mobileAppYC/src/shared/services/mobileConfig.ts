import client from './apiClient';

export type MobileEnv = 'dev' | 'staging' | 'prod';

export interface MobileConfig {
  env: MobileEnv;
  enablePayments: boolean;
  stripePublishableKey?: string;
  sentryDsn?: string;
}

export const fetchMobileConfig = async (): Promise<MobileConfig> => {
  const response = await client.get<MobileConfig>('/v1/mobile-config/');
  return response.data;
};
