import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL; // use NEXT_PUBLIC_ in Next.js for client env vars

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Generic GET function
export const getData = async <T>(endpoint: string, params: Record<string, unknown> = {}): Promise<AxiosResponse<T>> => {
  try {
    const response = await api.get<T>(endpoint, { params });
    return response;
  } catch (error) {
    console.error('API getData error:', error);
    throw error;
  }
};

// Generic POST function
export const postData = async <T>(endpoint: string, data: unknown): Promise<T> => {
  try {
    const response = await api.post<T>(endpoint, data);
    return response.data;
  } catch (error) {
    console.error('API postData error:', error);
    throw error;
  }
};

// Generic PUT function
export const putData = async <T>(endpoint: string, data: unknown): Promise<T> => {
  try {
    const response = await api.put<T>(endpoint, data);
    return response.data;
  } catch (error) {
    console.error('API putData error:', error);
    throw error;
  }
};

export default api;
