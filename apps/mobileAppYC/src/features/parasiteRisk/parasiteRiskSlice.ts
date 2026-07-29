import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {ParasiteRiskState, RiskLocation} from './types';
import {
  followLocation,
  loadRiskForLocation,
  loadSubscriptions,
  unfollowLocation,
} from './thunks';

/** Keep the recents list short enough to stay a shortcut rather than a history. */
const MAX_RECENT_LOCATIONS = 5;

const initialState: ParasiteRiskState = {
  location: null,
  reading: null,
  recentLocations: [],
  subscriptions: [],
  loading: false,
  subscriptionsLoading: false,
  error: null,
  disclaimerAcknowledged: false,
};

export const parasiteRiskInitialState = initialState;

const sameCell = (a: RiskLocation, b: RiskLocation): boolean =>
  a.label === b.label && a.countryCode === b.countryCode;

export const parasiteRiskSlice = createSlice({
  name: 'parasiteRisk',
  initialState,
  reducers: {
    acknowledgeDisclaimer(state) {
      state.disclaimerAcknowledged = true;
    },
    clearParasiteRiskError(state) {
      state.error = null;
    },
    resetParasiteRiskState() {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadRiskForLocation.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRiskForLocation.fulfilled, (state, action) => {
        state.loading = false;
        state.location = action.payload.location;
        state.reading = action.payload.reading;
        state.recentLocations = [
          action.payload.location,
          ...state.recentLocations.filter(
            entry => !sameCell(entry, action.payload.location),
          ),
        ].slice(0, MAX_RECENT_LOCATIONS);
      })
      .addCase(loadRiskForLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Something went wrong.';
      })
      .addCase(loadSubscriptions.pending, state => {
        state.subscriptionsLoading = true;
      })
      .addCase(loadSubscriptions.fulfilled, (state, action) => {
        state.subscriptionsLoading = false;
        state.subscriptions = action.payload;
      })
      .addCase(loadSubscriptions.rejected, (state, action) => {
        state.subscriptionsLoading = false;
        state.error = action.payload ?? 'Something went wrong.';
      })
      .addCase(followLocation.fulfilled, (state, action) => {
        state.subscriptions = [
          ...state.subscriptions.filter(
            entry => entry.id !== action.payload.id,
          ),
          action.payload,
        ];
      })
      .addCase(followLocation.rejected, (state, action) => {
        state.error = action.payload ?? 'Something went wrong.';
      })
      .addCase(
        unfollowLocation.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.subscriptions = state.subscriptions.filter(
            entry => entry.id !== action.payload,
          );
        },
      )
      .addCase(unfollowLocation.rejected, (state, action) => {
        state.error = action.payload ?? 'Something went wrong.';
      });
  },
});

export const {
  acknowledgeDisclaimer,
  clearParasiteRiskError,
  resetParasiteRiskState,
} = parasiteRiskSlice.actions;

export const parasiteRiskReducer = parasiteRiskSlice.reducer;
