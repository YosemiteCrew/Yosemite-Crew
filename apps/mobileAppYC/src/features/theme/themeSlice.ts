import {Appearance} from 'react-native';
import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

import type {ThemeState} from './types';

const initialState: ThemeState = {
  isDark: Appearance.getColorScheme() === 'dark',
  theme: 'system',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;

      if (action.payload === 'system') {
        state.isDark = Appearance.getColorScheme() === 'dark';
      } else {
        state.isDark = action.payload === 'dark';
      }
    },
    toggleTheme: state => {
      if (state.theme === 'system') {
        state.theme = state.isDark ? 'light' : 'dark';
      } else {
        state.theme = state.isDark ? 'light' : 'dark';
      }
      state.isDark = !state.isDark;
    },
    updateSystemTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      if (state.theme === 'system') {
        state.isDark = action.payload === 'dark';
      }
    },
  },
});

export const {setTheme, toggleTheme, updateSystemTheme} = themeSlice.actions;
export default themeSlice.reducer;
