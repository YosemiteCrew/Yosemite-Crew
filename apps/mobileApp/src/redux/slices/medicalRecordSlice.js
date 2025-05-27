import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setLoading } from './loadingSlice';
import API from '../../services/API';

export const get_medical_record_list = createAsyncThunk(
  'Observation/getMedicalRecordList',
  async (credentials, { rejectWithValue, dispatch }) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `getMedicalRecordList`,
        body: {},
        method: 'GET',
      });
      dispatch(setLoading(false));
      console.log(
        'getMedicalRecordList_response=>>',
        JSON.stringify(response?.data)
      );
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  }
);
