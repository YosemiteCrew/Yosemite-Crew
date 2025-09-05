import {createAsyncThunk} from '@reduxjs/toolkit';
import {logout} from '../slices/authSlice';
import {updatePetList} from '../slices/petSlice';
import API from '../../services/API';
import {showToast} from '../../components/Toast';
import {setLoading} from './loadingSlice';

export const makeThunk = (
  type,
  route,
  {
    multiPart = false,
    formUrl = false,
    showToastMessage = true,
    method = 'POST',
    onSuccess, // callback
    transformBody,
    headers, // allow custom headers
  } = {},
) =>
  createAsyncThunk(type, async (data, {dispatch, rejectWithValue}) => {
    console.log('petDataKK', JSON.stringify(data));

    try {
      dispatch(setLoading(true));

      const resolvedRoute = typeof route === 'function' ? route(data) : route;
      const requestBody =
        method === 'GET'
          ? {}
          : transformBody
          ? transformBody(data) // e.g. only api_credentials
          : data;

      // 👇 decide headers: either use passed headers or default ones
      const finalHeaders = headers
        ? headers
        : {
            'Content-Type': formUrl
              ? 'application/x-www-form-urlencoded'
              : 'multipart/form-data',
          };

      const response = await API({
        route: resolvedRoute,
        method,
        body: requestBody,
        multiPart,
        headers: finalHeaders,
      });

      dispatch(setLoading(false));

      if (showToastMessage) {
        showToast(response?.data?.status, response?.data?.message);
      }

      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      // special case: logout
      if (resolvedRoute === 'auth/logout' && response?.data?.status === 1) {
        dispatch(logout());
        dispatch(updatePetList([]));
      }

      // 👇 call onSuccess if provided
      if (typeof onSuccess === 'function') {
        onSuccess(response?.data, dispatch);
      }

      return response?.data;
    } catch (err) {
      dispatch(setLoading(false));
      return rejectWithValue(err);
    }
  });

export default makeThunk;
