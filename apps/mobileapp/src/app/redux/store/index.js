import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from '../slices/authSlice';
import loadingReducer from '../slices/loadingSlice';
import petsReducer from '../slices/petSlice';

let persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  // whitelist: ['persist'],
};

let rootReducer = combineReducers({
  auth: authReducer,
  //   offers: offerReducer,
  //   getToken: getTokenReducer,
  loading: loadingReducer,
  pets: petsReducer,
  //   transactions: transactionReducer,
  //   logout: logoutReducer,
  //   chatList: chatListReducer,
  //   message: sendMessageReducer,
  //   getMessage: getMessageReducer,
});

let persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

export default store;
