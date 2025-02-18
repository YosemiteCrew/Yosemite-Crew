import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

export const get_pet_list = createAsyncThunk(
  'getpets',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          //   'Content-Type': 'multipart/form-data',
        },
        route: `getpets`,
        body: credentials,
        method: 'POST',
        // multiPart: true,
      });
      dispatch(setLoading(false));
      console.log('getpets_response=>>', JSON.stringify(response?.data));
      if (response?.status === 200) {
        // navigationContainerRef?.navigate()
      }
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
