// src/services/Axios.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import store from '../redux/store';
import { API_BASE_URL } from '@/constants';
import { logout, logout_user, updateUser } from '../redux/slices/authSlice';
import { showToast } from '../components/Toast';
import { getUser } from '../utils/constants';
import { User } from '@/types/api';

interface RefreshTokenResponse {
  status: number;
  accessToken: string;
  // ... add other properties if they exist
}

axios.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // This is where you would get the token from state and add it to headers
    const token = store.getState().auth.user?.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.baseURL = API_BASE_URL;
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  },
);

axios.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.config && error.response) {
      const originalRequest = error.config;

      if (
        error.response.status === 401 &&
        originalRequest.url === '/auth/refreshToken'
      ) {
        showToast(0, 'Session expired, please login again');
        // This is the corrected dispatch call
        store.dispatch(logout());
        return Promise.reject(error);
      }

      // @ts-ignore - Allow custom _retry property
      if (error.response.status === 401 && !originalRequest._retry) {
        // @ts-ignore
        originalRequest._retry = true;
        const userData = store.getState().auth?.user;

        try {
          const res = await axios.post<RefreshTokenResponse>(
            '/auth/refreshToken',
            { refreshToken: userData?.refreshToken },
          );

          if (res.status === 200 && res.data.status === 1) {
            store.dispatch(
              updateUser({
                ...(userData as User),
                accessToken: res.data.accessToken,
              }),
            );

            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
            }
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.log('Error in refresh token API:', refreshError);
        }
      }
    }
    return Promise.reject(error);
  },
);