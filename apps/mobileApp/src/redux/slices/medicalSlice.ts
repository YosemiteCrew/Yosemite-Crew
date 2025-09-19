import { createAsyncThunk } from '@reduxjs/toolkit';
import { setLoading } from './loadingSlice';
import API from '../../services/API';
import { AddMedicalRecordPayload } from '@/types/api';

export const add_medical_record = createAsyncThunk<
  any,
  AddMedicalRecordPayload
>(
  'medical/saveMedicalRecord',
  async (credentials, { rejectWithValue, dispatch }) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        route: 'saveMedicalRecord',
        body: credentials,
        method: 'POST',
        multiPart: true,
      });

      dispatch(setLoading(false));

      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      dispatch(setLoading(false));
      return rejectWithValue(error);
    }
  },
);