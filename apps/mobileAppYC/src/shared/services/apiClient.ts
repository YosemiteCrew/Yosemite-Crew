import {Platform} from 'react-native';
import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {API_CONFIG} from '@/config/variables';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const shouldLogNetworkActivity = typeof __DEV__ === 'undefined' || __DEV__;

const buildAbsoluteUrl = (config: AxiosRequestConfig): string => {
  const rawUrl = config.url ?? '';
  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  return config.baseURL && !isAbsolute
    ? `${config.baseURL.replace(/\/$/, '')}/${rawUrl.replace(/^\//, '')}`
    : rawUrl;
};

const normalizeBaseUrl = (url: string): string => {
  if (!url) {
    return url;
  }

  if (Platform.OS !== 'android') {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
      const port = parsed.port ? `:${parsed.port}` : '';
      const normalized = `${parsed.protocol}//10.0.2.2${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
      return normalized;
    }
    return url;
  } catch {
    return url
      .replace('://localhost', '://10.0.2.2')
      .replace('://127.0.0.1', '://10.0.2.2');
  }
};

const client: AxiosInstance = axios.create({
  baseURL: normalizeBaseUrl(API_CONFIG.baseUrl),
  timeout: API_CONFIG.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(config => {
  if (shouldLogNetworkActivity) {
    console.log('[API] Request', {
      method: config.method,
      url: buildAbsoluteUrl(config),
      timeout: config.timeout,
      hasBody: config.data != null,
    });
  }
  return config;
});

client.interceptors.response.use(
  response => {
    if (shouldLogNetworkActivity) {
      console.log('[API] Response', {
        method: response.config?.method,
        url: buildAbsoluteUrl(response.config ?? {}),
        status: response.status,
      });
    }
    return response;
  },
  error => {
    if (shouldLogNetworkActivity) {
      if (error.response) {
        console.log('[API] Error Response', {
          method: error.config?.method,
          url: buildAbsoluteUrl(error.config ?? {}),
          status: error.response.status,
          message: error.message,
        });
      } else {
        console.log('[API] Error', {
          method: error.config?.method,
          url: buildAbsoluteUrl(error.config ?? {}),
          message: error.message,
        });
      }
    }
    return Promise.reject(error);
  },
);

export const updateApiClientBaseConfig = (config: {
  baseUrl?: string;
  timeoutMs?: number;
}): void => {
  if (config.baseUrl) {
    client.defaults.baseURL = normalizeBaseUrl(config.baseUrl);
  }
  if (typeof config.timeoutMs === 'number') {
    client.defaults.timeout = config.timeoutMs;
  }
  if (shouldLogNetworkActivity) {
    console.log('[API] Base config updated', {
      baseURL: client.defaults.baseURL,
      timeout: client.defaults.timeout,
    });
  }
};

export const withAuthHeaders = (
  accessToken: string,
  extras?: AxiosRequestConfig['headers'],
): AxiosRequestConfig['headers'] => {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
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
