import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

import type {WeightUnit, DistanceUnit} from '@/shared/utils/measurementSystem';
import type {CurrencyCode} from '@/shared/utils/currency';
import type {PreferencesState} from './types';

const initialState: PreferencesState = {
  weightOverride: null,
  distanceOverride: null,
  currencyOverride: null,
};

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setWeightOverride: (state, action: PayloadAction<WeightUnit | null>) => {
      state.weightOverride = action.payload;
    },
    setDistanceOverride: (
      state,
      action: PayloadAction<DistanceUnit | null>,
    ) => {
      state.distanceOverride = action.payload;
    },
    setCurrencyOverride: (
      state,
      action: PayloadAction<CurrencyCode | null>,
    ) => {
      state.currencyOverride = action.payload;
    },
  },
});

export const {setWeightOverride, setDistanceOverride, setCurrencyOverride} =
  preferencesSlice.actions;
export default preferencesSlice.reducer;
