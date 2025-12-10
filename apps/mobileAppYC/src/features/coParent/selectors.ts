import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {CoParentState} from './types';

const defaultCoParentState: CoParentState = {
  coParents: [],
  pendingInvites: [],
  accessByCompanionId: {},
  defaultAccess: null,
  lastFetchedRole: null,
  lastFetchedPermissions: null,
  loading: false,
  invitesLoading: false,
  accessLoading: false,
  error: null,
  selectedCoParentId: null,
};

const selectCoParentState = (state: RootState) => state.coParent ?? defaultCoParentState;

export const selectCoParents = createSelector(
  [selectCoParentState],
  state => state.coParents,
);

export const selectPendingInvites = createSelector(
  [selectCoParentState],
  state => state.pendingInvites,
);

export const selectInvitesLoading = createSelector(
  [selectCoParentState],
  state => state.invitesLoading,
);

export const selectAccessLoading = createSelector(
  [selectCoParentState],
  state => state.accessLoading,
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
  coParents =>
    coParents.filter(cp => (cp.status ?? '').toLowerCase() === 'accepted'),
);

export const selectPendingCoParents = createSelector(
  [selectCoParents],
  coParents =>
    coParents.filter(cp => (cp.status ?? '').toLowerCase() === 'pending'),
);

export const selectAccessByCompanionId = (state: RootState) =>
  state?.coParent?.accessByCompanionId ?? {};

export const selectAccessForCompanion = (state: RootState, companionId: string | null | undefined) =>
  companionId ? selectAccessByCompanionId(state)?.[companionId] ?? null : null;
