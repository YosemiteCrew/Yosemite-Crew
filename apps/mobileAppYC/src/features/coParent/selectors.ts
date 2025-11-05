import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';

const selectCoParentState = (state: RootState) => state.coParent;

export const selectCoParents = createSelector(
  [selectCoParentState],
  state => state.coParents,
);

export const selectCoParentLoading = createSelector(
  [selectCoParentState],
  state => state.loading,
);

export const selectCoParentError = createSelector(
  [selectCoParentState],
  state => state.error,
);

export const selectSelectedCoParentId = createSelector(
  [selectCoParentState],
  state => state.selectedCoParentId,
);

export const selectSelectedCoParent = createSelector(
  [selectCoParents, selectSelectedCoParentId],
  (coParents, selectedId) =>
    selectedId ? coParents.find(cp => cp.id === selectedId) : null,
);

export const selectCoParentById = (id: string) =>
  createSelector([selectCoParents], coParents =>
    coParents.find(cp => cp.id === id),
  );

export const selectAcceptedCoParents = createSelector(
  [selectCoParents],
  coParents => coParents.filter(cp => cp.status === 'accepted'),
);

export const selectPendingCoParents = createSelector(
  [selectCoParents],
  coParents => coParents.filter(cp => cp.status === 'pending'),
);
