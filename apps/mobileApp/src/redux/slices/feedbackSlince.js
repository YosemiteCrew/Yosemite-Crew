import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

export const get_feedback_list = createAsyncThunk(
  'Observation/getFeedBack',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Observation/getFeedBack`,
        body: credentials,
        method: 'GET',
      });
      dispatch(setLoading(false));
      console.log('getFeedBack_response=>>', JSON.stringify(response?.data));
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

export const save_a_feedback = createAsyncThunk(
  'Observation/saveFeedBack',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Observation/saveFeedBack`,
        body: credentials,
        method: 'POST',
        multiPart: true,
      });
      dispatch(setLoading(false));
      console.log('saveFeedBack_response=>>', JSON.stringify(response?.data));
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

export const update_a_feedback = createAsyncThunk(
  'Observation/editFeedBack',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Observation/editFeedBack?feedbackId=${credentials?.feedBackId}`,
        body: credentials?.fhirData,
        method: 'PUT',
        multiPart: true,
      });
      dispatch(setLoading(false));
      console.log('editFeedBack_response=>>', JSON.stringify(response?.data));
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

export const delete_a_feedback = createAsyncThunk(
  'Observation/deleteFeedBack',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Observation/deleteFeedBack?feedbackId=${credentials?.feedBackId}`,
        body: {},
        method: 'DELETE',
      });
      dispatch(setLoading(false));
      console.log('deleteFeedBack_response=>>', JSON.stringify(response?.data));
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
