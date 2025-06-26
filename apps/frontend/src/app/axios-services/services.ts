import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError,
  AxiosRequestConfig,
} from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL; // NEXT_PUBLIC_ required for frontend use

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem('token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ===============================
// ✅ GET Request
// ===============================
export const getData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return await api.get<T>(endpoint, { params });
  } catch (error: unknown) {
    console.error('API getData error:', error);
    throw error;
  }
};

// ===============================
// ✅ POST Request
// ===============================
export const postData = async <T, D = unknown>(
  endpoint: string,
  data: D,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  try {
    return await api.post<T>(endpoint, data, config);
  } catch (error: unknown) {
    console.error("API postData error:", error);
    throw error;
  }
};

// ===============================
// ✅ PUT Request
// ===============================
export const putData = async <T, D = unknown>(
  endpoint: string,
  data: D
): Promise<AxiosResponse<T>> => {
  try {
    return await api.put<T>(endpoint, data);
  } catch (error: unknown) {
    console.error('API putData error:', error);
    throw error;
  }
};

// ===============================
// ✅ DELETE Request
// ===============================
export const deleteData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return await api.delete<T>(endpoint, { params });
  } catch (error: unknown) {
    console.error('API deleteData error:', error);
    throw error;
  }
};

export default api;
