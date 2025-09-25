import {configureStore} from '@reduxjs/toolkit';
import {authSlice, themeSlice, petSlice} from './slices';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    theme: themeSlice,
    pets: petSlice,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export * from './types';
export * from './slices';