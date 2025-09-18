// src/redux/slices/medicalSlice.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { setLoading } from './loadingSlice';
import API from '../../services/API';
import { AddMedicalRecordPayload } from '@/types/api';

export const add_medical_record = createAsyncThunk<
  any, // The type of the successful response payload
  AddMedicalRecordPayload // The type of the argument we pass to the thunk
>(
  'medical/saveMedicalRecord',
  async (credentials, { rejectWithValue, dispatch }) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        // The API function is already typed to handle FormData
        route: 'saveMedicalRecord',
        body: credentials,
        method: 'POST',
        multiPart: true, // Assuming your API function handles this
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