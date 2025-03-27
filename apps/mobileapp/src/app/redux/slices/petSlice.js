import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {setLoading} from './loadingSlice';
import API from '../../services/API';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';

const initialState = {
  petLists: [],
  loading: false,
  error: null,
};

export const get_pet_list = createAsyncThunk(
  'getPets',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          //   'Content-Type': 'multipart/form-data',
        },
        route: `getPets`,
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

      return response?.data?.data;
    } catch (error) {
      console.log(error);
      return rejectWithValue(error);
    }
  },
);
export const add_pet = createAsyncThunk(
  'addPet',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {},
        route: `addPet`,
        body: credentials,
        method: 'POST',
      });

      dispatch(setLoading(false));

      console.log('addPet_responses=>>', response?.data);
      console.log('addPet_response=>>', response?.data?.data);

      if (response?.status === 200) {
        navigationContainerRef?.navigate('MyPets');
        return response?.data?.data;
      } else {
        return rejectWithValue(response?.data);
      }
    } catch (error) {
      console.log('API Error:', error);
      return rejectWithValue(error);
    }
  },
);

export const contact_us = createAsyncThunk(
  'User/sendquery',
  async (credentials, {rejectWithValue, dispatch, getState}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'application/json',
        },
        route: 'sendquery',
        body: credentials,
        method: 'POST',
        // multiPart: true,
      });

      dispatch(setLoading(false));
      showToast(response?.data?.status, response?.data?.message);
      if (response?.data?.status === 1) {
        navigationContainerRef?.goBack();
      }
      if (response?.data?.status !== 1) {
        return rejectWithValue(response?.data);
      }
      console.log('response?.data?.data', response?.data?.data);

      return response?.data?.data;
    } catch (error) {
      dispatch(setLoading(false));
      console.log('contactUs_error==>', error?.message);
      if (error?.message === 'Network Error') {
        showToast(0, validationError[error?.message]);
      }

      showToast(0, validationError[error.response.data?.message]);

      return rejectWithValue(error.response.data);
    }
  },
);

const petsSlice = createSlice({
  name: 'pets',
  initialState,
  reducers: {
    addPet: (state, action) => {
      state.pets.push(action.payload);
    },
  },
  extraReducers: builder => {
    builder.addCase(add_pet.pending, state => {
      state.loading = true;
    });
    builder.addCase(add_pet.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    builder.addCase(add_pet.fulfilled, (state, action) => {
      state.loading = false;
      console.log('petListPayLoad', action.payload);
      state.petLists = [action.payload, ...state.petLists];
    });
    builder.addCase(get_pet_list.pending, state => {
      state.loading = true;
    });
    builder.addCase(get_pet_list.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    builder.addCase(get_pet_list.fulfilled, (state, action) => {
      state.loading = false;
      console.log('getPetListPayLoad', action.payload);
      state.petLists = action.payload;
    });
  },
});

export const {addPet} = petsSlice.actions;
export default petsSlice.reducer;
