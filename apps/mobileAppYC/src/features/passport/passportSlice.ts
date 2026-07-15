import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import type {PetPassportDTO} from '@yosemite-crew/types';
import {passportApi} from '@/features/passport/services/passportService';

interface PassportState {
  byCompanionId: Record<string, PetPassportDTO>;
  loading: boolean;
  error: string | null;
}

const initialState: PassportState = {
  byCompanionId: {},
  loading: false,
  error: null,
};

export const fetchPassport = createAsyncThunk<
  {companionId: string; passport: PetPassportDTO},
  {companionId: string},
  {rejectValue: string}
>('passport/fetchPassport', async ({companionId}, {rejectWithValue}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a pet to view the passport.');
    }

    const passport = await passportApi.fetchPassport(companionId);
    return {companionId, passport};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to load passport',
    );
  }
});

const passportSlice = createSlice({
  name: 'passport',
  initialState,
  reducers: {
    clearPassportError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPassport.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPassport.fulfilled, (state, action) => {
        state.loading = false;
        state.byCompanionId[action.payload.companionId] =
          action.payload.passport;
      })
      .addCase(fetchPassport.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) ?? action.error.message ?? null;
      });
  },
});

export const {clearPassportError} = passportSlice.actions;
export default passportSlice.reducer;
