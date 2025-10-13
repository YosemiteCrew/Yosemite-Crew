// src/features/companion/selectors.ts
import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';

export const selectCompanionState = (state: RootState) => state.companion;

export const selectCompanions = createSelector(
  [selectCompanionState],
  companionState => companionState.companions
);

export const selectSelectedCompanionId = createSelector(
  [selectCompanionState],
  companionState => companionState.selectedCompanionId
);

export const selectSelectedCompanion = createSelector(
  [selectCompanions, selectSelectedCompanionId],
  (companions, selectedId) =>
    selectedId ? companions.find(c => c.id === selectedId) ?? null : null
);

export const selectCompanionLoading = createSelector(
  [selectCompanionState],
  companionState => companionState.loading
);

export const selectCompanionError = createSelector(
  [selectCompanionState],
  companionState => companionState.error
);

export const selectCompanionsByCategory = createSelector(
  [selectCompanions, (_state: RootState, category: string) => category],
  (companions, category) =>
    companions.filter(c => c.category === category)
);
