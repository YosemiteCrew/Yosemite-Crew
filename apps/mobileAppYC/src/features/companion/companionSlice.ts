// src/features/companion/companionSlice.ts
import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {Companion, CompanionState} from './types';
import {
  addCompanion,
  fetchCompanions,
  deleteCompanion,
  updateCompanionProfile,
} from './thunks';

const initialState: CompanionState = {
  companions: [],
  selectedCompanionId: null,
  loading: false,
  error: null,
};

export const companionSlice = createSlice({
  name: 'companion',
  initialState,
  reducers: {
    setSelectedCompanion(state, action: PayloadAction<string | null>) {
      state.selectedCompanionId = action.payload;
    },
    clearCompanionError(state) {
      state.error = null;
    },
    resetCompanionState() {
      return initialState;
    },
    updateCompanion(state, action: PayloadAction<Companion>) {
      const index = state.companions.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.companions[index] = action.payload;
      }
    },
    removeCompanion(state, action: PayloadAction<string>) {
      state.companions = state.companions.filter(c => c.id !== action.payload);
      // If the deleted companion was selected, select the first one or null
      if (state.selectedCompanionId === action.payload) {
        state.selectedCompanionId =
          state.companions.length > 0 ? state.companions[0].id : null;
      }
    },
  },
  extraReducers: builder => {
    builder
      // Fetch companions
      .addCase(fetchCompanions.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanions.fulfilled, (state, action) => {
        state.loading = false;
        state.companions = action.payload;
        state.error = null;
      })
      .addCase(fetchCompanions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch companions';
      })

      .addCase(updateCompanionProfile.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCompanionProfile.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        const index = state.companions.findIndex(c => c.id === updated.id);
        if (index !== -1) {
          state.companions[index] = updated;
        }
        state.error = null;
      })
      .addCase(updateCompanionProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to update companion';
      })
      // Add companion
      .addCase(addCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCompanion.fulfilled, (state, action) => {
        state.loading = false;
        state.companions.push(action.payload);
        state.error = null;
      })
      .addCase(addCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to add companion';
      })
      .addCase(deleteCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCompanion.fulfilled, (state, action) => {
        state.loading = false;
        const deletedId = action.payload;
        state.companions = state.companions.filter(c => c.id !== deletedId);
        // If the deleted companion was selected, update the selection
        if (state.selectedCompanionId === deletedId) {
          state.selectedCompanionId =
            state.companions.length > 0 ? state.companions[0].id : null;
        }
      })
      .addCase(deleteCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to delete companion';
      });
  },
});

export const {
  setSelectedCompanion,
  clearCompanionError,
  resetCompanionState,
  updateCompanion,
  removeCompanion,
} = companionSlice.actions;

export default companionSlice.reducer;
