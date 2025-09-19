import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { navigationContainerRef } from '../../../App';
import { showToast } from '../../components/Toast';
import { transformPets } from '../../helpers/transformPetListData';
import { makeThunk } from './thunks';
import { PetState, ExtractedPet, FHIRBundle, FHIRPatientForList } from '@/types/api';

const initialState: PetState = {
  petLists: [],
  loading: false,
  error: null,
};

// --- Thunks ---
export const get_pet_list = makeThunk<FHIRBundle, { limit: number; offset: number }>(
  'Patient/getPets',
  d => `Patient/getPets?limit=${d.limit}&offset=${d.offset}`,
  { method: 'GET', showToastMessage: false },
);

export const add_pet = makeThunk<{ data: FHIRPatientForList; status: number }, FormData>(
  'Patient/addPet',
  'Patient/addPet',
  {
    multiPart: true,
    onSuccess: res => {
      if (res?.status === 1) {
        navigationContainerRef?.navigate('StackScreens', {
          screen: 'PetProfileList',
        } as any);
      }
    },
  },
);

export const delete_pet_api = makeThunk<{ data: { status: number; message: string } }, { petId: string }>(
  'Patient/deletePet',
  d => `Patient/deletepet?Petid=${d.petId}`,
  {
    method: 'DELETE',
    onSuccess: res => {
      if (res?.data?.status === 1) showToast(res?.data?.status, res?.data?.message);
    },
  },
);

export const edit_pet_api = makeThunk<any, { petId: string; api_credentials: any }>(
  'Patient/editPet',
  d => `Patient/editPet?Petid=${d.petId}`,
  {
    method: 'PUT',
    multiPart: true,
    transformBody: d => d.api_credentials,
  },
);

export const get_pet_summary = makeThunk<any, { petId: string }>(
  'Organization/petSummary',
  d => `Organization/petSummary/${d.petId}`,
  { method: 'GET', showToastMessage: false },
);

export const contact_us = makeThunk<any, FormData>('User/sendquery', 'sendquery', {
  multiPart: true,
});

export const add_pet_breeder_details = makeThunk<any, FormData>('Organization/addBreederDetails', 'Organization/addBreederDetails', { multiPart: true });
export const add_pet_groomer_details = makeThunk<any, FormData>('Organization/addPetGroomer', 'Organization/addPetGroomer', { multiPart: true });
export const add_pet_boarding_details = makeThunk<any, FormData>('Organization/addPetBoarding', 'Organization/addPetBoarding', { multiPart: true });
export const add_pet_vet_details = makeThunk<any, FormData>('Organization/addVetClinic', 'Organization/addVetClinic', { multiPart: true });
export const withdrawRequest = makeThunk<any, FormData>('auth/withdrawRequestForm', 'auth/withdrawRequestForm', { multiPart: true });

const petsSlice = createSlice({
  name: 'pets',
  initialState,
  reducers: {
    addPet: (state, action: PayloadAction<ExtractedPet>) => {
      state.petLists.push(action.payload);
    },
    updatePetList: (state, action: PayloadAction<ExtractedPet[]>) => {
      state.petLists = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addMatcher(
        action => action.type.endsWith('/pending'),
        state => {
          state.loading = true;
        },
      )
      .addMatcher(
        action => action.type.endsWith('/rejected'),
        (state, action: PayloadAction<any>) => {
          state.loading = false;
          state.error = action.payload;
        },
      )
      .addMatcher(
        action => action.type.endsWith('/fulfilled'),
        (state, action: PayloadAction<any>) => {
          state.loading = false;
          if (add_pet.fulfilled.match(action) && action.payload.status === 1) {
            const newPet = transformPets([{ resource: action.payload.data }]);
            state.petLists = [...state.petLists, ...newPet];
          }
          if (get_pet_list.fulfilled.match(action)) {
            state.petLists = transformPets(action.payload.entry);
          }
        },
      );
  },
});

export const { addPet, updatePetList } = petsSlice.actions;
export default petsSlice.reducer;