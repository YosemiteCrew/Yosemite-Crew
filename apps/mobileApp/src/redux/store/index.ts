import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {persistReducer, persistStore} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from '../slices/authSlice';
import loadingReducer from '../slices/loadingSlice';
import petsReducer from '../slices/petSlice';
import medicalRecordReducer from '../slices/medicalRecordSlice';

let persistConfig = {
  key: 'root',
  storage: AsyncStorage,
};

let rootReducer = combineReducers({
  auth: authReducer,
  loading: loadingReducer,
  pets: petsReducer,
  medicalRecord: medicalRecordReducer,
});

let persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
});

// Add these two lines to export the types for your hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const persistor = persistStore(store);

export default store;