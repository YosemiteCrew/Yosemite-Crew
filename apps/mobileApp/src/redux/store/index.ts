// src/redux/store/index.ts
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from '../slices/authSlice';
import loadingReducer from '../slices/loadingSlice';
import petsReducer from '../slices/petSlice';
import medicalRecordReducer from '../slices/medicalRecordSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
};

const rootReducer = combineReducers({
  auth: authReducer,
  loading: loadingReducer,
  pets: petsReducer,
  medicalRecord: medicalRecordReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
});

// Infer the `RootState` from the root reducer BEFORE persistence
export type RootState = ReturnType<typeof rootReducer>;
// Infer the `AppDispatch` type from the store
export type AppDispatch = typeof store.dispatch;

export const persistor = persistStore(store);

export default store;