import axios from 'axios';
import Axios from './Axios';
import {API_BASE_URL, FHIR_API_BASE_URL} from '../constants';
import store from '../redux/store';
import {Alert} from 'react-native';

export default async function API(props) {
  //SET URL
  let path = API_BASE_URL;
  let route = props.route;
  if (
    route === 'auth/signup' ||
    route === 'auth/sendOtp' ||
    route === 'auth/login' ||
    route === 'auth/confirmSignup' ||
    route === 'auth/resendConfirmationCode' ||
    route === 'auth/logout' ||
    route === 'auth/social-login' ||
    route === 'auth/updateProfileDetail' ||
    route === 'auth/deleteAccountWithToken' ||
    route === 'auth/withdrawRequestForm'
  ) {
    path = API_BASE_URL;
  } else {
    path = FHIR_API_BASE_URL;
  }
  let url = props?.path ? props?.path : path + route;

  if (props.url) {
    url = props.url;
  }

  let method = props.method || 'GET';
  let body = props.body || {};
  if (method !== 'POST' && method !== 'PUT') {
    let param = [];
    Object.entries(body).forEach(([key, value]) =>
      param.push(`${key}=${value}&`),
    );
    if (param.length > 0) {
      url = `${url}?${param.join('')}`;
    }
  }

  let multiPartData = props?.multiPart;
  const formData = new FormData();
  if (multiPartData) {
    formData.append('data', JSON.stringify(body?.data));
    if (Array.isArray(body?.files)) {
      for (let i = 0; i < body?.files.length; i++) {
        // console.log('Post Image into append', body?.files[i]);
        formData.append('files', body?.files[i]);
      }
    }
  }

  const authState = store.getState().auth;

  let accessToken = authState?.user?.token;

  //SET HEADERS
  let headers = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (props.headers) {
    headers = {...headers, ...props.headers};
  }
  //SET REQUEST
  const request = {
    method: method,
    url: url,
    headers: headers,
  };
  if (method != 'GET') {
    // request.data = multiPartData ? formData : body;

    request.data = multiPartData ? formData : body;
  }

  //CALL API
  try {
    let response = await axios(request);

    return response;
  } catch (error) {
    // Alert.alert(error?.code, error?.message);
    // console.log('errors', error?.code);
    if (error.request) {
      global.networkError = true;
      Alert.alert(
        'Network Error',
        'Something is temporarily wrong with your network connection. Please make sure you are connected to the internet.',
        [
          {
            text: 'OK',
            onPress: () => (global.networkError = false),
          },
        ],
      );
    }
    if (!error.response) {
      return {
        status: 26,
        error: error,
      };
    }
    return error;
  }
}
