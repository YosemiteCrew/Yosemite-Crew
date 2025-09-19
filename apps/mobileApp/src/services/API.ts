// src/services/API.ts
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
// The 'import Axios from ./Axios' was unused and has been removed.
import { API_BASE_URL, FHIR_API_BASE_URL } from '../constants';
import store from '../redux/store';
import { Alert } from 'react-native';
import { getUser } from '../utils/constants'; // Assuming getUser is also in utils

// 1. Define the shape of the props object
interface ApiProps {
  route: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  multiPart?: boolean;
  path?: string; // For custom, full URLs
  url?: string; // Legacy support, same as path
}

export default async function API(
  props: ApiProps,
): Promise<AxiosResponse | any> {
  // SET URL
  let path = API_BASE_URL;
  const { route, body = {} } = props;

  // This logic can likely be simplified, but we'll keep it for now
  if (
    ![
      'auth/signup',
      'auth/sendOtp',
      'auth/login',
      'auth/confirmSignup',
      'auth/resendConfirmationCode',
      'auth/logout',
      'auth/social-login',
      'auth/updateProfileDetail',
      'auth/deleteAccountWithToken',
      'auth/withdrawRequestForm',
    ].includes(route)
  ) {
    path = FHIR_API_BASE_URL;
  }

  let url = props.path || props.url || path + route;
  const method = props.method || 'GET';

  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    const params = new URLSearchParams(body).toString();
    if (params) {
      url = `${url}?${params}`;
    }
  }

  const { multiPart } = props;
  const formData = new FormData();
  if (multiPart) {
    formData.append('data', JSON.stringify(body?.data));
    if (Array.isArray(body?.files)) {
      body.files.forEach((file: any) => formData.append('files', file));
    }
  }

  const authState = store.getState().auth;
  const accessToken = authState?.user?.token;

  // 2. Define the request object with the AxiosRequestConfig type
  const request: AxiosRequestConfig = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...props.headers,
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    // 3. This line now works because 'data' is a valid property of AxiosRequestConfig
    request.data = multiPart ? formData : body;
  }

  // CALL API
  try {
    const response = await axios(request);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.request && !error.response) {
        // This is a network error
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.',
        );
      }
      return error.response || error; // Return the response or the error itself
    }
    // Handle non-axios errors
    return { status: 500, data: { message: 'An unknown error occurred.' } };
  }
}