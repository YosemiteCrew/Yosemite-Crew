import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {ParasiteId} from './types';

const selectParasiteRisk = (state: RootState) => state.parasiteRisk;

export const selectRiskLocation = createSelector(
  selectParasiteRisk,
  state => state.location,
);

export const selectRiskReading = createSelector(
  selectParasiteRisk,
  state => state.reading,
);

export const selectRiskReadings = createSelector(
  selectRiskReading,
  reading => reading?.readings ?? [],
);

/** The single most severe parasite, which drives the headline and the dial. */
export const selectHeadlineReading = createSelector(
  selectRiskReadings,
  readings => readings[0] ?? null,
);

export const selectRiskLoading = createSelector(
  selectParasiteRisk,
  state => state.loading,
);

export const selectRiskError = createSelector(
  selectParasiteRisk,
  state => state.error,
);

export const selectRecentRiskLocations = createSelector(
  selectParasiteRisk,
  state => state.recentLocations,
);

export const selectRiskSubscriptions = createSelector(
  selectParasiteRisk,
  state => state.subscriptions,
);

export const selectDisclaimerAcknowledged = createSelector(
  selectParasiteRisk,
  state => state.disclaimerAcknowledged,
);

export const selectReadingForParasite = (parasiteId: ParasiteId | null) =>
  createSelector(
    selectRiskReadings,
    readings =>
      readings.find(reading => reading.parasiteId === parasiteId) ?? null,
  );

/** True when the current location is already followed for alerts. */
export const selectIsCurrentLocationFollowed = createSelector(
  selectRiskLocation,
  selectRiskSubscriptions,
  (location, subscriptions) =>
    location !== null &&
    subscriptions.some(entry => entry.label === location.label),
);
