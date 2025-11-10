import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import type {BusinessesState} from './types';
import {mockBusinesses, mockEmployees, mockServices, mockAvailability} from './mocks';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const fetchBusinesses = createAsyncThunk('businesses/fetch', async () => {
  await delay(200);
  return {businesses: mockBusinesses, employees: mockEmployees, services: mockServices};
});

export const fetchAvailability = createAsyncThunk('businesses/availability', async () => {
  await delay(200);
  return {availability: mockAvailability};
});

const initialState: BusinessesState = {
  businesses: [],
  employees: [],
  services: [],
  availability: [],
  loading: false,
  error: null,
};

const businessesSlice = createSlice({
  name: 'businesses',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBusinesses.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBusinesses.fulfilled, (state, action) => {
        state.loading = false;
        state.businesses = action.payload.businesses;
        state.employees = action.payload.employees;
        state.services = action.payload.services;
      })
      .addCase(fetchBusinesses.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.error?.message as string) ?? 'Failed to fetch businesses';
      })
      .addCase(fetchAvailability.fulfilled, (state, action) => {
        state.availability = action.payload.availability;
      });
  },
});

export default businessesSlice.reducer;
