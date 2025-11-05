import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import type {LinkedBusinessesState} from './types';
import {
  addLinkedBusiness,
  deleteLinkedBusiness,
  acceptBusinessInvite,
  declineBusinessInvite,
  searchBusinessesByLocation,
  searchBusinessByQRCode,
} from './thunks';

const initialState: LinkedBusinessesState = {
  linkedBusinesses: [],
  loading: false,
  error: null,
};

export const linkedBusinessesSlice = createSlice({
  name: 'linkedBusinesses',
  initialState,
  reducers: {
    setSelectedCategory(state, action: PayloadAction<'hospital' | 'boarder' | 'breeder' | 'groomer'>) {
      state.selectedCategory = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    initializeMockData(_state) {
      // Reserved for future mock data initialization if needed
      // Currently not used - businesses are added via addLinkedBusiness action
    },
    resetLinkedBusinesses(state) {
      // Reset to initial state (clears all linked businesses)
      // Used on logout and when user switches accounts
      state.linkedBusinesses = [];
      state.loading = false;
      state.error = null;
      state.selectedCategory = undefined;
    },
  },
  extraReducers: builder => {
    // Search businesses
    builder
      .addCase(searchBusinessesByLocation.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchBusinessesByLocation.fulfilled, state => {
        state.loading = false;
      })
      .addCase(searchBusinessesByLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to search businesses';
      });

    // Search by QR code
    builder
      .addCase(searchBusinessByQRCode.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchBusinessByQRCode.fulfilled, state => {
        state.loading = false;
      })
      .addCase(searchBusinessByQRCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to scan QR code';
      });

    // Add linked business
    builder
      .addCase(addLinkedBusiness.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addLinkedBusiness.fulfilled, (state, action) => {
        state.loading = false;
        state.linkedBusinesses.push(action.payload);
      })
      .addCase(addLinkedBusiness.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to add business';
      });

    // Delete linked business
    builder
      .addCase(deleteLinkedBusiness.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteLinkedBusiness.fulfilled, (state, action) => {
        state.loading = false;
        state.linkedBusinesses = state.linkedBusinesses.filter(b => b.id !== action.payload);
      })
      .addCase(deleteLinkedBusiness.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to delete business';
      });

    // Accept invite
    builder
      .addCase(acceptBusinessInvite.pending, state => {
        state.loading = true;
      })
      .addCase(acceptBusinessInvite.fulfilled, (state, action) => {
        state.loading = false;
        const business = state.linkedBusinesses.find(b => b.id === action.payload);
        if (business) {
          business.inviteStatus = 'accepted';
        }
      })
      .addCase(acceptBusinessInvite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to accept invite';
      });

    // Decline invite
    builder
      .addCase(declineBusinessInvite.pending, state => {
        state.loading = true;
      })
      .addCase(declineBusinessInvite.fulfilled, (state, action) => {
        state.loading = false;
        const business = state.linkedBusinesses.find(b => b.id === action.payload);
        if (business) {
          business.inviteStatus = 'declined';
        }
      })
      .addCase(declineBusinessInvite.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to decline invite';
      });
  },
});

export const {setSelectedCategory, clearError, initializeMockData, resetLinkedBusinesses} = linkedBusinessesSlice.actions;
export default linkedBusinessesSlice.reducer;
