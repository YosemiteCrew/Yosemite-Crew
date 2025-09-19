import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { API_BASE_URL, FHIR_API_BASE_URL } from '../constants';
import store from '../redux/store';
import { Alert } from 'react-native';
import { getUser } from '../utils/constants';

interface ApiProps {
  route: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  multiPart?: boolean;
  path?: string;
  url?: string;
}

export default async function API(
  props: ApiProps,
): Promise<AxiosResponse | any> {
  let path = API_BASE_URL;
  const { route, body = {} } = props;

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
  const accessToken = authState?.user?.accessToken;

  const request: AxiosRequestConfig = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...props.headers,
    },
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    request.data = multiPart ? formData : body;
  }

  try {
    const response = await axios(request);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.request && !error.response) {
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.',
        );
      }
      return error.response || error; // Return the response or the error itself
    }
    return { status: 500, data: { message: 'An unknown error occurred.' } };
  }
}