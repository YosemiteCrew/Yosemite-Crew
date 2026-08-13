import {createSlice, isAnyOf, type PayloadAction} from '@reduxjs/toolkit';
import type {ParasiteRiskState, RiskLocation} from './types';
import {
  followLocation,
  loadRiskForLocation,
  loadSubscriptions,
  unfollowLocation,
} from './thunks';

/** Keep the recents list short enough to stay a shortcut rather than a history. */
const MAX_RECENT_LOCATIONS = 5;

/** Used only when a thunk rejects without a message of its own. */
const FALLBACK_ERROR = 'Something went wrong.';

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
      .addCase(loadRiskForLocation.rejected, state => {
        state.loading = false;
      })
      .addCase(loadSubscriptions.pending, state => {
        state.subscriptionsLoading = true;
      })
      .addCase(loadSubscriptions.fulfilled, (state, action) => {
        state.subscriptionsLoading = false;
        state.subscriptions = action.payload;
      })
      .addCase(loadSubscriptions.rejected, state => {
        state.subscriptionsLoading = false;
      })
      .addCase(followLocation.fulfilled, (state, action) => {
        state.subscriptions = [
          ...state.subscriptions.filter(
            entry => entry.id !== action.payload.id,
          ),
          action.payload,
        ];
      })
      .addCase(
        unfollowLocation.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.subscriptions = state.subscriptions.filter(
            entry => entry.id !== action.payload,
          );
        },
      )
      // Every rejection surfaces its message the same way, so it is assigned in
      // one place rather than repeated per thunk.
      .addMatcher(
        isAnyOf(
          loadRiskForLocation.rejected,
          loadSubscriptions.rejected,
          followLocation.rejected,
          unfollowLocation.rejected,
        ),
        (state, action) => {
          state.error = action.payload ?? FALLBACK_ERROR;
        },
      );
  },
});

export const {
  acknowledgeDisclaimer,
  clearParasiteRiskError,
  resetParasiteRiskState,
} = parasiteRiskSlice.actions;

export const parasiteRiskReducer = parasiteRiskSlice.reducer;
