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
  } = {},
) =>
  createAsyncThunk(type, async (data, {dispatch, rejectWithValue}) => {
    try {
      dispatch(setLoading(true));

      // 👇 support route as string OR function
      const resolvedRoute = typeof route === 'function' ? route(data) : route;

      const response = await API({
        route: resolvedRoute,
        method,
        body: method === 'GET' ? {} : data, // 👈 ensure empty body for GET
        multiPart,
        headers: {
          'Content-Type': formUrl
            ? 'application/x-www-form-urlencoded'
            : 'multipart/form-data',
        },
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

      return response?.data;
    } catch (err) {
      dispatch(setLoading(false));
      return rejectWithValue(err);
    }
  });

export default makeThunk;
