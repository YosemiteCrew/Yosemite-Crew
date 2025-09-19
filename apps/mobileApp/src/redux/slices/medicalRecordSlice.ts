import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { showToast } from '../../components/Toast';
import { makeThunk } from './thunks';
import { MedicalRecordState, MedicalFolder, AddMedicalRecordPayload } from '@/types/api';

const initialState: MedicalRecordState = {
  folderList: [],
  loading: false,
};

export const get_medical_record_list = makeThunk<any, void>(
  'Observation/getMedicalRecordList',
  'getMedicalRecordList',
  { method: 'GET', showToastMessage: false },
);

export const add_medical_record = makeThunk<any, AddMedicalRecordPayload>(
  'Observation/saveMedicalRecord',
  'DocumentReference/saveMedicalRecord',
  {
    method: 'POST',
    multiPart: true,
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);

export const get_medical_record_by_id = makeThunk<any, { id: string }>(
  'Observation/getMedicalRecordById',
  d => `DocumentReference/getMedicalRecordById?recordId=${d.id}`,
  { method: 'GET', showToastMessage: false },
);

export const get_medical_folders = makeThunk<MedicalFolder[], { petId: string }>(
  'Observation/getMedicalFolderList',
  d => `DocumentReference/getMedicalFolderList?petId=${d.petId}`,
  { method: 'GET', showToastMessage: false },
);

export const create_medical_folders = makeThunk<any, any>(
  'Observation/saveMedicalFolder',
  'DocumentReference/saveMedicalFolder',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    showToastMessage: false,
  },
);

const medicalRecordSlice = createSlice({
  name: 'medicalRecord',
  initialState,
  reducers: {
    setFolderList: (state, action: PayloadAction<MedicalFolder[]>) => {
      state.folderList = action.payload;
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
        state => {
          state.loading = false;
        },
      )
      .addMatcher(
        action => action.type.endsWith('/fulfilled'),
        (state, action) => {
          state.loading = false;
          if (get_medical_folders.fulfilled.match(action)) {
            // The payload is now correctly typed as MedicalFolder[]
            state.folderList = action.payload;
          }
        },
      );
  },
});

export const { setFolderList } = medicalRecordSlice.actions;
export default medicalRecordSlice.reducer;