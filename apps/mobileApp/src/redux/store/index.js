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
  // whitelist: ['persist'],
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

export const persistor = persistStore(store);

export default store;
