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
    if (res?.status === 200) {
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
  d => `Patient/editPet/${d?.petId}`,
  {
    method: 'PUT',
    multiPart: true,
    onSuccess: res => {
      if (res?.data?.issue?.[0]?.status === 1)
        showToast(1, res?.data?.issue[0]?.diagnostics);
    },
  },
);

export const contact_us = makeThunk('User/sendquery', 'sendquery', {
  headers: {'Content-Type': 'application/json'},
  multiPart: true,
  onSuccess: res => {
    showToast(res?.data?.status, res?.data?.message);
    if (res?.data?.status === 1) navigationContainerRef?.goBack();
  },
});

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
            s.petLists = {
              ...s.petLists,
              total: (s.petLists.total || 0) + 1,
              entry: [...(s.petLists.entry || []), {resource: a.payload}],
            };
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
