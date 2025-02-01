import {createSlice} from '@reduxjs/toolkit';

const initialState = {
  loading: false,
};

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const {setLoading} = loadingSlice.actions;
export const selectedLoading = state => state.loading.loading;
export default loadingSlice.reducer;
