import axios from 'axios';
// import Axios from './Axios';
import {API_BASE_URL} from '../constants';
import store from '../redux/store';
import {Alert} from 'react-native';

export default async function API(props) {
  //SET URL
  let path = API_BASE_URL;
  let route = props.route;
  let url = props?.path ? props?.path : path + route;

  if (props.url) {
    url = props.url;
  }

  let method = props.method || 'GET';
  let body = props.body || {};
  if (method == 'GET') {
    let param = [];
    Object.entries(body).forEach(([key, value]) =>
      param.push(`${key}=${value}`),
    );
    if (param.length > 0) {
      url = `${url}?${param.join('&')}`;
    }
  }

  let multiPartData = props?.multiPart;
  const formData = new FormData();

  if (multiPartData) {
    Object.keys(body).forEach(key => {
      if (Array.isArray(body[key])) {
        // Append each array element with the same key
        body[key].forEach(item => {
          formData.append(key, item);
        });
      } else {
        formData.append(key, body[key]);
      }
    });
  }

  const authState = store.getState().auth;

  let accessToken = authState?.user?.token;

  //   let headers = {};
  //SET HEADERS
  let headers = {
    // 'Content-Type': 'multipart/form-data',
    Authorization: `Bearer ${accessToken}`,
    // locale: locale || systemLocale || 'en',
  };
  if (props.headers) {
    headers = {...headers, ...props.headers};
    console.log('TempHeaders2=>>', headers);
  }
  console.log(url);
  //SET REQUEST
  const request = {
    method: method,
    url: url,
    headers: headers,
  };
  if (method != 'GET') {
    // request.data = multiPartData ? formData : body;
    console.log('formDataValue', JSON.stringify(formData));

    request.data = multiPartData ? formData : body;
  }

  console.log('request', request);

  //CALL API
  try {
    let response = await axios(request);
    console.log('response=>>>>', JSON.stringify(response));
    console.log('response=>>>>', JSON.stringify(response?.data));

    return response;
  } catch (error) {
    console.log('errors0012555', error);
    // Alert.alert(error?.code, error?.message);
    console.log('errors', error?.code);
    console.log('errors0012', error?.message);
    if (error?.code == 'ERR_NETWORK' && !global.networkError) {
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
