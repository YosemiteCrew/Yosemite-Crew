import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from "axios";
import { useAuthStore } from '@/app/stores/authStore'; 

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Axios interceptor to set Authorization using token from your AuthStore session
api.interceptors.request.use(
  async (config) => {
    try {
      const session = useAuthStore.getState().session;
      if (session && config.headers) {
        const token = session.getIdToken().getJwtToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('No valid Cognito session available from AuthStore', error);
    }
    return config;
  },
  (error) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
);

// GET Request
export const getData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return await api.get<T>(endpoint, {
      params,
    });
  } catch (error: unknown) {
    console.error("API getData error:", error);
    throw error;
  }
};

// POST Request
export const postData = async <T, D = unknown>(
  endpoint: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  try {
    return await api.post<T>(endpoint, data, {
      ...config,
    });
  } catch (error: unknown) {
    console.error("API postData error:", error);
    throw error;
  }
};

// PUT Request
export const putData = async <T, D = unknown>(
  endpoint: string,
  data?: D
): Promise<AxiosResponse<T>> => {
  try {
    return await api.put<T>(endpoint, data);
  } catch (error: unknown) {
    console.error("API putData error:", error);
    throw error;
  }
};

// DELETE Request
export const deleteData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return await api.delete<T>(endpoint, {
      params,
    });
  } catch (error: unknown) {
    console.error("API deleteData error:", error);
    throw error;
  }
};

export default api;
