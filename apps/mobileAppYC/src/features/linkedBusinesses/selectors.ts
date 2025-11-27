import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';

export const selectLinkedBusinesses = (state: RootState) =>
  state.linkedBusinesses.linkedBusinesses;

export const selectLinkedBusinessesLoading = (state: RootState) =>
  state.linkedBusinesses.loading;

export const selectLinkedBusinessesError = (state: RootState) =>
  state.linkedBusinesses.error;

export const selectSelectedCategory = (state: RootState) =>
  state.linkedBusinesses.selectedCategory;

// Memoized selector factory for category filtering
const selectCategoryParam = (_state: RootState, category: string) => category;

export const selectLinkedBusinessesByCategory = createSelector(
  [selectLinkedBusinesses, selectCategoryParam],
  (businesses, category) => businesses.filter(b => b.category === category),
);

// Memoized selector factory for companion filtering
const selectCompanionIdParam = (_state: RootState, companionId: string) => companionId;

export const selectLinkedBusinessesByCompanion = createSelector(
  [selectLinkedBusinesses, selectCompanionIdParam],
  (businesses, companionId) => businesses.filter(b => b.companionId === companionId),
);

// Memoized selector factory for hospitals by companion
const selectCompanionIdForHospitals = (_state: RootState, companionId: string | null) =>
  companionId;

export const selectLinkedHospitalsForCompanion = createSelector(
  [selectLinkedBusinesses, selectCompanionIdForHospitals],
  (businesses, companionId) => {
    if (!companionId) return [];
    return businesses.filter(
      b =>
        b.companionId === companionId &&
        b.category === 'hospital' &&
        (b.inviteStatus === 'accepted' || b.state === 'active'),
    );
  },
);
