// src/services/Axios.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
// 👇 1. Import types directly from axios
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import store from '../redux/store';
import { API_BASE_URL } from '@/constants'; // Using path alias
import { logout_user, updateUser } from '../redux/slices/authSlice';
import { showToast } from '../components/Toast';
import { getUser } from '../utils/constants';

// Define the shape of the refresh token API response
interface RefreshTokenResponse {
  status: number;
  accessToken: string;
}

// REQUEST INTERCEPTOR
axios.interceptors.request.use(
  // 👇 2. Add type for the config object
  (config: InternalAxiosRequestConfig) => {
    config.baseURL = API_BASE_URL;
    return config;
  },
  (error: any) => {
    // This part is simple, so 'any' is acceptable
    return Promise.reject(error);
  },
);

// RESPONSE INTERCEPTOR
axios.interceptors.response.use(
  // 👇 3. Add type for the response object
  (response: AxiosResponse) => {
    return response;
  },
  async (error: unknown) => {
    // 👇 4. Use a type guard to safely handle Axios-specific errors
    if (axios.isAxiosError(error) && error.config && error.response) {
      const originalRequest = error.config;
      const user = getUser();

      // Case 1: Refresh token call itself fails with 401
      if (
        error.response.status === 401 &&
        originalRequest.url === '/auth/refreshToken'
      ) {
        showToast(0, 'Session expired, please login again');
        store.dispatch(logout_user());
        return Promise.reject(error);
      }

      // Case 2: Any other API call fails with 401, try to refresh
      // @ts-ignore - Adding a custom property to the config
      if (error.response.status === 401 && !originalRequest._retry) {
        const state = store.getState();
        const userData = state.auth?.user;

        // @ts-ignore - Setting our custom property
        originalRequest._retry = true;

        try {
          const res = await axios.post<RefreshTokenResponse>(
            '/auth/refreshToken',
            { refreshToken: userData?.refreshToken },
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          if (res.status === 200 && res.data.status === 1) {
            store.dispatch(
              updateUser({
                ...userData,
                accessToken: res.data.accessToken,
                refreshToken: userData?.refreshToken,
              }),
            );

            // Update the header of the original request and retry it
            originalRequest.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.log('Error in refresh token API:', refreshError);
          // Handle the case where refresh fails, e.g., log out the user
        }
      }
    }
    // For non-Axios errors or errors we don't handle, just reject
    return Promise.reject(error);
  },
);