import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosRequestConfig,
} from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // ✅ Required for cookie-based auth
});

// ===============================
// ✅ GET Request
// ===============================
export const getData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return  api.get<T>(endpoint, {
      params,
      withCredentials: true,
    });
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
  data?: D,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  try {
    return await api.post<T>(endpoint, data, {
      ...config,
      withCredentials: true,
    });
  } catch (error: unknown) {
    console.error('API postData error:', error);
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
    return await api.put<T>(endpoint, data, {
      withCredentials: true,
    });
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
    return await api.delete<T>(endpoint, {
      params,
      withCredentials: true,
    });
  } catch (error: unknown) {
    console.error('API deleteData error:', error);
    throw error;
  }
};

export default api;
