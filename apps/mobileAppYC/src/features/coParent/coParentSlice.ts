import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {CoParentState, ParentCompanionAccess} from './types';
import {
  fetchCoParents,
  addCoParent,
  updateCoParentPermissions,
  deleteCoParent,
  fetchPendingInvites,
  acceptCoParentInvite,
  declineCoParentInvite,
  fetchParentAccess,
} from './thunks';

const initialState: CoParentState = {
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

export const coParentSlice = createSlice({
  name: 'coParent',
  initialState,
  reducers: {
    setSelectedCoParent(state, action: PayloadAction<string | null>) {
      state.selectedCoParentId = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    // Fetch CoParents
    builder
      .addCase(fetchCoParents.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCoParents.fulfilled, (state, action) => {
        state.loading = false;
        state.coParents = action.payload;
      })
      .addCase(fetchCoParents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Add CoParent
    builder
      .addCase(addCoParent.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCoParent.fulfilled, (state, action) => {
        state.loading = false;
        const existingIndex = state.coParents.findIndex(cp => cp.id === action.payload.id);
        if (existingIndex >= 0) {
          state.coParents[existingIndex] = action.payload;
        } else {
          state.coParents.push(action.payload);
        }
      })
      .addCase(addCoParent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update CoParent Permissions
    builder
      .addCase(updateCoParentPermissions.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCoParentPermissions.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.coParents.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.coParents[index] = action.payload;
        }
      })
      .addCase(updateCoParentPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Delete CoParent
    builder
      .addCase(deleteCoParent.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCoParent.fulfilled, (state, action) => {
        state.loading = false;
        state.coParents = state.coParents.filter(c => c.id !== action.payload.coParentId);
      })
      .addCase(deleteCoParent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Pending invites
    builder
      .addCase(fetchPendingInvites.pending, state => {
        state.invitesLoading = true;
        state.error = null;
      })
      .addCase(fetchPendingInvites.fulfilled, (state, action) => {
        state.invitesLoading = false;
        state.pendingInvites = action.payload;
      })
      .addCase(fetchPendingInvites.rejected, (state, action) => {
        state.invitesLoading = false;
        state.error = action.payload as string;
      })
      .addCase(acceptCoParentInvite.fulfilled, (state, action) => {
        state.pendingInvites = state.pendingInvites.filter(
          invite => invite.token !== action.payload,
        );
        state.invitesLoading = false;
      })
      .addCase(acceptCoParentInvite.rejected, (state, action) => {
        state.invitesLoading = false;
        state.error = action.payload as string;
      })
      .addCase(declineCoParentInvite.fulfilled, (state, action) => {
        state.pendingInvites = state.pendingInvites.filter(
          invite => invite.token !== action.payload,
        );
        state.invitesLoading = false;
      })
      .addCase(declineCoParentInvite.rejected, (state, action) => {
        state.invitesLoading = false;
        state.error = action.payload as string;
      });

    // Parent access / permissions
    builder
      .addCase(fetchParentAccess.pending, state => {
        state.accessLoading = true;
        state.error = null;
      })
      .addCase(fetchParentAccess.fulfilled, (state, action) => {
        state.accessLoading = false;
        const updates = action.payload;
        updates.forEach(access => {
          const companionId = access.companionId;
          if (!companionId) {
            if (!state.defaultAccess) {
              state.defaultAccess = access as ParentCompanionAccess;
            }
          } else {
            state.accessByCompanionId[companionId] = access as ParentCompanionAccess;
          }
        });
        if (updates.length > 0) {
          const first = updates.find(u => Boolean(u.role)) ?? updates[0];
          state.lastFetchedRole = first.role ?? null;
          state.lastFetchedPermissions = first.permissions ?? null;
        }
      })
      .addCase(fetchParentAccess.rejected, (state, action) => {
        state.accessLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {setSelectedCoParent, clearError} = coParentSlice.actions;

export default coParentSlice.reducer;
