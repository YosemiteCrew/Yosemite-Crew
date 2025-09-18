// src/redux/slices/thunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import API from '../../services/API';
import { showToast } from '../../components/Toast';
import { setLoading } from './loadingSlice';
import { AppDispatch, RootState } from '../store';

interface MakeThunkOptions<Returned, ThunkArg> {
  multiPart?: boolean;
  formUrl?: boolean;
  showToastMessage?: boolean;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  onSuccess?: (response: Returned, dispatch: AppDispatch) => void;
  transformBody?: (data: ThunkArg) => any;
  headers?: Record<string, string>;
}

export const makeThunk = <Returned, ThunkArg>(
  type: string,
  route: string | ((data: ThunkArg) => string),
  options: MakeThunkOptions<Returned, ThunkArg> = {},
) =>
  createAsyncThunk<
    Returned,
    ThunkArg,
    {
      dispatch: AppDispatch;
      state: RootState;
    }
  >(type, async (data, { dispatch, rejectWithValue }) => {
    const {
      multiPart = false,
      formUrl = false,
      showToastMessage = true,
      method = 'POST',
      onSuccess,
      transformBody,
      headers,
    } = options;

    try {
      dispatch(setLoading(true));

      const resolvedRoute = typeof route === 'function' ? route(data) : route;
      const requestBody =
        method === 'GET' ? {} : transformBody ? transformBody(data) : data;

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

      if (showToastMessage && response?.data?.message) {
        showToast(response?.data?.status, response?.data?.message);
      }

      if (response.status < 200 || response.status >= 300) {
        return rejectWithValue(response?.data);
      }

      if (typeof onSuccess === 'function') {
        onSuccess(response?.data, dispatch);
      }

      return response?.data as Returned;
    } catch (err: any) {
      dispatch(setLoading(false));
      return rejectWithValue(err.response?.data || err.message);
    }
  });