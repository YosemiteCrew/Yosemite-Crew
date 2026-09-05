import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import {snapToRiskCell} from '@yosemite-crew/types';
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

export const selectSubscriptionsLoading = createSelector(
  selectParasiteRisk,
  state => state.subscriptionsLoading,
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

/** The subscription for the current forecast cell, when one exists. */
export const selectCurrentLocationSubscription = createSelector(
  selectRiskLocation,
  selectRiskSubscriptions,
  (location, subscriptions) => {
    if (!location) return null;
    const cell = snapToRiskCell(location.lat, location.lon);
    return (
      subscriptions.find(
        entry => entry.lat === cell.lat && entry.lon === cell.lon,
      ) ?? null
    );
  },
);

/** True when the current location is already followed for alerts. */
export const selectIsCurrentLocationFollowed = createSelector(
  selectCurrentLocationSubscription,
  subscription => subscription !== null,
);
