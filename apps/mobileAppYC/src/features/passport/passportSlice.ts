import {createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import {isAxiosError} from 'axios';
import type {PetPassportDTO} from '@yosemite-crew/types';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
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

// The backend 404s the public passport endpoint when a pet has never been
// issued a passport. That is the normal empty state the screen renders a
// prompt for, not a failure, so it resolves as a passport-less result.
const isPassportNotIssued = (error: unknown): boolean =>
  isAxiosError(error) && error.response?.status === 404;

// The passport routes are owner-scoped and authenticated; apiClient does not
// attach credentials on its own, so the token is resolved per call.
export const ensurePassportAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

export const fetchPassport = createAsyncThunk<
  {companionId: string; passport: PetPassportDTO | null},
  {companionId: string},
  {rejectValue: string}
>('passport/fetchPassport', async ({companionId}, {rejectWithValue}) => {
  try {
    if (!companionId) {
      throw new Error('Please select a pet to view the passport.');
    }

    const accessToken = await ensurePassportAccessToken();
    const passport = await passportApi.fetchPassport(companionId, accessToken);
    return {companionId, passport};
  } catch (error) {
    if (isPassportNotIssued(error)) {
      return {companionId, passport: null};
    }

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
        const {companionId, passport} = action.payload;
        if (passport) {
          state.byCompanionId[companionId] = passport;
        } else {
          delete state.byCompanionId[companionId];
        }
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
