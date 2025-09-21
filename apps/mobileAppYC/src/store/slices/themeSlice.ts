import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {ThemeState} from '../types';
import {Appearance} from 'react-native';

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
        state.isDark = !state.isDark;
      } else {
        state.theme = state.isDark ? 'light' : 'dark';
        state.isDark = !state.isDark;
      }
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