import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import store from '../redux/store';
import {API_BASE_URL} from '../constants';
import {logout, logout_user, updateUser} from '../redux/slices/authSlice';
import {showToast} from '../components/Toast';
import {getUser} from '../utils/constants';

// ADD A REQUEST INTERCEPTOR
axios.interceptors.request.use(
  config => {
    config.baseURL = API_BASE_URL;
    return config;
  },
  error => {
    Promise.reject(error);
  },
);

//ADD A RESPONSE INTERCEPTOR
axios.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const originalRequest = error.config;
    const user = getUser();

    if (
      error.response.status === 401 &&
      originalRequest.url === '/auth/refreshToken'
    ) {
      showToast(0, 'Session expired, please login again');
      store.dispatch(
        logout_user({
          deviceToken: (await AsyncStorage.getItem('fcmToken')) || '1234',
        }),
      );
      // apiLogout(userData);
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      const state = store.getState();
      const userData = state.auth?.user;

      originalRequest._retry = true;

      try {
        const res = await axios.post(
          '/auth/refreshToken',
          {
            refreshToken: userData?.refreshToken,
          },
          {
            headers: {
              // Authorization: `Bearer ${user?.accessToken}`, // replace YOUR_TOKEN_HERE with your actual token
              'Content-Type': 'application/x-www-form-urlencoded', // specify content type if needed
            },
          },
        );
        if (res.status === 200) {
          if (res?.data?.status === 1) {
            store.dispatch(
              updateUser({
                ...userData,
                accessToken: res?.data?.accessToken,
                refreshToken: userData?.refreshToken,
              }),
            );
          }

          originalRequest.headers[
            'Authorization'
          ] = `Bearer ${res?.data?.accessToken}`;
          return axios(originalRequest);
        }
      } catch (error) {
        console.log('error in refresh token API :', error?.response?.data);
      }
    }
    return Promise.reject(error);
  },
);
