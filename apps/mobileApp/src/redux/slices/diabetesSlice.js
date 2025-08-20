import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

export const get_diabetes_list = createAsyncThunk(
  'Observation/getDiabetesLogs',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Observation/getDiabetesLogs`,
        body: credentials,
        method: 'GET',
      });
      dispatch(setLoading(false));

      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  },
);

export const add_diabetes_record_api = createAsyncThunk(
  'Observation/saveDiabetesRecords',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `saveDiabetesRecords`,
        body: credentials,
        method: 'POST',
        multiPart: true,
      });
      dispatch(setLoading(false));
      showToast(response?.data?.status, response?.data?.message);

      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  },
);
