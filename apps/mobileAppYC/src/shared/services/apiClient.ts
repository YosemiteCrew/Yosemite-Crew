import {Platform} from 'react-native';
import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {API_CONFIG} from '@/config/variables';

const normalizeBaseUrl = (url: string): string => {
  if (!url) {
    return url;
  }

  if (Platform.OS === 'android') {
    return url
      .replace('://localhost', '://10.0.2.2')
      .replace('://127.0.0.1', '://10.0.2.2');
  }

  return url;
};

const client: AxiosInstance = axios.create({
  baseURL: normalizeBaseUrl(API_CONFIG.baseUrl),
  timeout: API_CONFIG.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const withAuthHeaders = (
  accessToken: string,
  extras?: AxiosRequestConfig['headers'],
): AxiosRequestConfig['headers'] => {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (!extras) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    ...extras,
  };
};

export default client;
