import {Platform} from 'react-native';
import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {API_CONFIG} from '@/config/variables';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

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
  const rawUrl = config.url ?? '';
  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  const url = config.baseURL && !isAbsolute
    ? `${config.baseURL.replace(/\/$/, '')}/${rawUrl.replace(/^\//, '')}`
    : rawUrl;
  console.log('[API] Request', {
    method: config.method,
    url,
    headers: config.headers,
    data: config.data,
    timeout: config.timeout,
    timestamp: new Date().toISOString(),
  });
  return config;
});

client.interceptors.response.use(
  response => {
    console.log('[API] Response', {
      method: response.config?.method,
      url: response.config?.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  error => {
    if (error.response) {
      console.log('[API] Error Response', {
        method: error.config?.method,
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.log('[API] Error', {
        message: error.message,
        config: error.config,
      });
    }
    return Promise.reject(error);
  },
);

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
