// src/redux/slices/loadingSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { LoadingState } from '@/types/api';

const initialState: LoadingState = {
  loading: false,
};

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    // The typo 'in' has been removed from this line
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setLoading } = loadingSlice.actions;

export const selectedLoading = (state: RootState) => state.loading.loading;

export default loadingSlice.reducer;