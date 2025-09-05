import {createSlice} from '@reduxjs/toolkit';
import {navigationContainerRef} from '../../../App';
import {showToast} from '../../components/Toast';
import {transformPets} from '../../helpers/transformPetListData';
import makeThunk from './thunks';

const initialState = {petLists: [], loading: false, error: null};

// Thunks
export const get_pet_list = makeThunk(
  'Patient/getPets',
  d => `Patient/getPets?limit=${d?.limit}&offset=${d?.offset}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);

export const add_pet = makeThunk('Patient/addPet', 'Patient/addPet', {
  multiPart: true,
  onSuccess: res => {
    if (res?.status === 1) {
      navigationContainerRef?.navigate('StackScreens', {
        screen: 'PetProfileList',
      });
    }
  },
});

export const delete_pet_api = makeThunk(
  'Patient/deletePet',
  d => `Patient/deletepet?Petid=${d?.petId}`,
  {
    method: 'DELETE',
    onSuccess: res => {
      if (res?.data?.status === 1)
        showToast(res?.data?.status, res?.data?.message);
    },
  },
);

export const edit_pet_api = makeThunk(
  'Patient/editPet',
  d => `Patient/editPet?Petid=${d?.petId}`,
  {
    method: 'PUT',
    multiPart: true,
    transformBody: d => d.api_credentials,
  },
);

export const get_pet_summary = makeThunk(
  'Organization/petSummary',
  d => `Organization/petSummary/${d?.petId}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);

export const contact_us = makeThunk('User/sendquery', 'sendquery', {
  multiPart: true,
});

export const add_pet_breeder_details = makeThunk(
  'Organization/addBreederDetails',
  'Organization/addBreederDetails',
  {
    multiPart: true,
    onSuccess: res => {
      if (res?.status === 1) {
        // navigationContainerRef?.navigate('StackScreens', {
        //   screen: 'PetProfileList',
        // });
      }
    },
  },
);

export const add_pet_groomer_details = makeThunk(
  'Organization/addPetGroomer',
  'Organization/addPetGroomer',
  {
    multiPart: true,
    onSuccess: res => {
      if (res?.status === 1) {
      }
    },
  },
);

export const add_pet_boarding_details = makeThunk(
  'Organization/addPetBoarding',
  'Organization/addPetBoarding',
  {
    multiPart: true,
    onSuccess: res => {
      if (res?.status === 1) {
      }
    },
  },
);

export const add_pet_vet_details = makeThunk(
  'Organization/addVetClinic',
  'Organization/addVetClinic',
  {
    multiPart: true,
    onSuccess: res => {
      if (res?.status === 1) {
      }
    },
  },
);

export const withdrawRequest = makeThunk(
  'auth/withdrawRequestForm',
  'auth/withdrawRequestForm',
  {
    multiPart: true,
  },
);

const petsSlice = createSlice({
  name: 'pets',
  initialState,
  reducers: {
    addPet: (s, a) => {
      s.petLists.push(a.payload);
    },
    updatePetList: (s, a) => {
      s.petLists = a.payload;
    },
  },
  extraReducers: b => {
    b.addMatcher(
      a => a.type.endsWith('/pending'),
      s => {
        s.loading = true;
      },
    )
      .addMatcher(
        a => a.type.endsWith('/rejected'),
        (s, a) => {
          s.loading = false;
          s.error = a.payload;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/fulfilled'),
        (s, a) => {
          s.loading = false;
          if (a.type.startsWith('Patient/addPet')) {
            const newPet = transformPets([{resource: a.payload.data}]);
            s.petLists = [...(s.petLists || []), ...newPet];
          }
          if (a.type.startsWith('Patient/getPets')) {
            s.petLists = transformPets(a.payload.entry);
          }
        },
      );
  },
});

export const {addPet, updatePetList} = petsSlice.actions;
export default petsSlice.reducer;
