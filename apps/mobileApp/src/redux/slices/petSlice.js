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
  'Patient/getPets',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('credentials=>>>', credentials);

      const response = await API({
        headers: {
          //   'Content-Type': 'multipart/form-data',
        },
        route: `Patient/getPets?limit=${credentials?.limit}?offset=${credentials?.offset}`,
        body: {},
        method: 'GET',
        // multiPart: true,
      });
      dispatch(setLoading(false));
      console.log(
        'Patient/getPets_response=>>',
        JSON.stringify(response?.data),
      );
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
export const add_pet = createAsyncThunk(
  'Patient/addPet',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));
      console.log('AddPetCredentialss', JSON.stringify(credentials));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Patient/addPet`,
        body: credentials,
        method: 'POST',
        multiPart: true,
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

export const delete_pet_api = createAsyncThunk(
  'Patient/deletePet',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Patient/deletepet/${credentials?.petId}`,
        body: {},
        method: 'DELETE',
        multiPart: true,
      });

      dispatch(setLoading(false));
      console.log('deletePetLog', response?.data);

      if (response?.data?.issue[0]?.status === 1) {
        showToast(1, response?.data?.issue[0]?.diagnostics);
      } else {
        return rejectWithValue(response?.data);
      }
    } catch (error) {
      console.log('API Error:', error);
      return rejectWithValue(error);
    }
  },
);

export const edit_pet_api = createAsyncThunk(
  'Patient/editPet',
  async (credentials, {rejectWithValue, dispatch}) => {
    try {
      dispatch(setLoading(true));

      const response = await API({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        route: `Patient/editPet/${credentials?.petId}`,
        body: credentials?.api_credentials,
        method: 'PUT',
        multiPart: true,
      });

      dispatch(setLoading(false));
      console.log('deletePetLog', response?.data);

      if (response?.data?.issue[0]?.status === 1) {
        showToast(1, response?.data?.issue[0]?.diagnostics);
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
        multiPart: true,
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
    updatePetList: (state, action) => {
      console.log('actionPayloads', JSON.stringify(action.payload));

      state.petLists = action.payload;
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
      const updatedBundle = {
        ...state.petLists,
        total: state.petLists.total + 1,
        entry: [...state.petLists.entry, {resource: action.payload}],
      };
      state.petLists = updatedBundle;
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
      console.log('getPetListPayLoadss', JSON.stringify(action.payload));
      state.petLists = action.payload;
    });
  },
});

export const {addPet, updatePetList} = petsSlice.actions;
export default petsSlice.reducer;
