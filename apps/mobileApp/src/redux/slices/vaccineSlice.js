import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

export const get_vaccine_records = createAsyncThunk(
  'vaccineSlice/getVaccinationRecord',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `getVaccinationRecord`,
        body: credentials,
        method: 'GET',
      });
      dispatch(setLoading(false));
      console.log(
        'getVaccinationRecord_response=>>',
        JSON.stringify(response?.data),
      );
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);

export const add_vaccine_records = createAsyncThunk(
  'vaccineSlice/addVaccinationRecord',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Immunization/addVaccinationRecord`,
        body: credentials,
        method: 'POST',
        multiPart: true,
      });
      dispatch(setLoading(false));
      console.log(
        'addVaccinationRecord_response=>>',
        JSON.stringify(response?.data),
      );
      if (response.status !== 200) {
        return rejectWithValue(response?.data);
      }

      return response?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);

export const delete_vaccine_record_api = createAsyncThunk(
  'Immunization/deleteVaccinationRecord',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Immunization/deleteVaccinationRecord/${credentials?.vaccinationRecordId}`,
        body: {},
        method: 'DELETE',
      });

      dispatch(setLoading(false));
      console.log('deleteVaccinationRecordLog', response?.data);

      if (response?.data?.status === 1) {
        showToast(1, response?.data?.message);
      } else {
        return rejectWithValue(response?.data);
      }
      return response?.data;
    } catch (error) {
      console.log('API Error:', error);
      return rejectWithValue(error);
    }
  },
);
