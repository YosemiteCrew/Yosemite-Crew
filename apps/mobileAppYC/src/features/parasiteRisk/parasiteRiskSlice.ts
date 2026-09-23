import {createSlice, isAnyOf, type PayloadAction} from '@reduxjs/toolkit';
import {snapToRiskCell} from '@yosemite-crew/types';
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
const FALLBACK_ERROR = 'parasiteRisk.errors.forecast';

/**
 * The shared shape plus the id of the newest forecast request. Lookups can
 * overlap - the user can pick a second place while the first is still in
 * flight - so the id is kept to tell a current response from a stale one.
 */
interface ParasiteRiskSliceState extends ParasiteRiskState {
  latestRiskRequestId: string | null;
}

const initialState: ParasiteRiskSliceState = {
  location: null,
  reading: null,
  recentLocations: [],
  subscriptions: [],
  loading: false,
  subscriptionsLoading: false,
  error: null,
  disclaimerAcknowledged: false,
  latestRiskRequestId: null,
};

export const parasiteRiskInitialState = initialState;

/**
 * Two places are the same recent entry when they fall in the same forecast
 * cell. Labels are not identity: different towns share a name, and the reading
 * is per cell rather than per address.
 */
const sameCell = (a: RiskLocation, b: RiskLocation): boolean => {
  const cellA = snapToRiskCell(a.lat, a.lon);
  const cellB = snapToRiskCell(b.lat, b.lon);
  return cellA.lat === cellB.lat && cellA.lon === cellB.lon;
};

const snapLocation = (location: RiskLocation): RiskLocation => ({
  ...location,
  ...snapToRiskCell(location.lat, location.lon),
});

/**
 * True when a newer lookup started after this one, which makes the response
 * stale no matter which order the network resolved them in. A state rehydrated
 * from before this field existed knows of no newer request, so it accepts.
 */
const isSupersededRiskResponse = (
  state: ParasiteRiskSliceState,
  action: {meta: {requestId: string}},
): boolean =>
  Boolean(state.latestRiskRequestId) &&
  action.meta.requestId !== state.latestRiskRequestId;

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
      .addCase(loadRiskForLocation.pending, (state, action) => {
        state.latestRiskRequestId = action.meta.requestId;
        state.loading = true;
        state.error = null;
      })
      .addCase(loadRiskForLocation.fulfilled, (state, action) => {
        if (isSupersededRiskResponse(state, action)) {
          return;
        }
        const location = snapLocation(action.payload.location);
        state.loading = false;
        state.location = location;
        state.reading = action.payload.reading;
        state.recentLocations = [
          location,
          ...state.recentLocations.filter(entry => !sameCell(entry, location)),
        ].slice(0, MAX_RECENT_LOCATIONS);
      })
      .addCase(loadRiskForLocation.rejected, (state, action) => {
        if (isSupersededRiskResponse(state, action)) {
          return;
        }
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
      .addCase(followLocation.pending, state => {
        state.subscriptionsLoading = true;
      })
      .addCase(followLocation.fulfilled, (state, action) => {
        state.subscriptionsLoading = false;
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
          state.subscriptionsLoading = false;
          state.subscriptions = state.subscriptions.filter(
            entry => entry.id !== action.payload,
          );
        },
      )
      .addCase(unfollowLocation.pending, state => {
        state.subscriptionsLoading = true;
      })
      .addMatcher(
        isAnyOf(followLocation.rejected, unfollowLocation.rejected),
        state => {
          state.subscriptionsLoading = false;
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
          if (
            loadRiskForLocation.rejected.match(action) &&
            isSupersededRiskResponse(state, action)
          ) {
            return;
          }
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
