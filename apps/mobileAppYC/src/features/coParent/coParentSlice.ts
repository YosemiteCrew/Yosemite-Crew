import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {CoParentState} from './types';
import {
  fetchCoParents,
  addCoParent,
  updateCoParentPermissions,
  deleteCoParent,
  searchCoParentsByEmail,
} from './thunks';

const initialState: CoParentState = {
  coParents: [],
  loading: false,
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
        state.coParents.push(action.payload);
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
        state.coParents = state.coParents.filter(c => c.id !== action.payload);
      })
      .addCase(deleteCoParent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Search CoParents
    builder.addCase(searchCoParentsByEmail.fulfilled, () => {
      // This is just for returning search results, doesn't modify state
    });
  },
});

export const {setSelectedCoParent, clearError} = coParentSlice.actions;

export default coParentSlice.reducer;
