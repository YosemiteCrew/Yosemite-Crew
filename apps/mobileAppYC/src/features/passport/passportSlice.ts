import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import {isAxiosError} from 'axios';
import type {PetPassportDTO} from '@yosemite-crew/types';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {passportApi} from '@/features/passport/services/passportService';
import {toErrorMessage} from '@/shared/utils/serviceHelpers';

// The screen renders one companion at a time while several fetches can be in
// flight (backing out of pet A straight into pet B), so the request flags are
// keyed by companionId too. A single global loading/error pair would let a late
// resolution from the previous pet drive the currently displayed pet's UI.
interface PassportState {
  byCompanionId: Record<string, PetPassportDTO>;
  loadingByCompanionId: Record<string, boolean>;
  errorByCompanionId: Record<string, string | null>;
}

const initialState: PassportState = {
  byCompanionId: {},
  loadingByCompanionId: {},
  errorByCompanionId: {},
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

    // Via toErrorMessage, not error.message: an axios rejection's own
    // message is "Request failed with status code 401", and that is exactly
    // what a pet parent was shown on this screen after leaving the app idle
    // overnight. The helper turns a 401 into something they can act on.
    return rejectWithValue(toErrorMessage(error, 'Failed to load passport'));
  }
});

const passportSlice = createSlice({
  name: 'passport',
  initialState,
  reducers: {
    clearPassportError: (state, action: PayloadAction<string>) => {
      delete state.errorByCompanionId[action.payload];
    },
    // Passport data carries the owner's name, email and phone, so it must not
    // outlive the session it was fetched in - logout dispatches this alongside
    // every other user-data slice reset.
    resetPassportState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPassport.pending, (state, action) => {
        const {companionId} = action.meta.arg;
        state.loadingByCompanionId[companionId] = true;
        delete state.errorByCompanionId[companionId];
      })
      .addCase(fetchPassport.fulfilled, (state, action) => {
        const {companionId, passport} = action.payload;
        state.loadingByCompanionId[companionId] = false;
        if (passport) {
          state.byCompanionId[companionId] = passport;
        } else {
          delete state.byCompanionId[companionId];
        }
      })
      .addCase(fetchPassport.rejected, (state, action) => {
        const {companionId} = action.meta.arg;
        state.loadingByCompanionId[companionId] = false;
        state.errorByCompanionId[companionId] =
          action.payload ?? action.error.message ?? null;
      });
  },
});

export const {clearPassportError, resetPassportState} = passportSlice.actions;
export default passportSlice.reducer;
