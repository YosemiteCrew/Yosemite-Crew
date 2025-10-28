import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Under Jest worker processes some imports can run before test setup mocks are applied
// and redux-persist expects a storage with Promise-returning methods. To make tests
// robust, use a tiny in-memory Promise-based storage when running under Jest.
const isJest = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;
const storageForPersist = isJest
  ? ((): any => {
      const store: Record<string, string> = {};
      return {
        getItem: async (key: string) => (key in store ? store[key] : null),
        setItem: async (key: string, value: string) => {
          store[key] = value;
          return null;
        },
        removeItem: async (key: string) => {
          delete store[key];
          return null;
        },
        getAllKeys: async () => Object.keys(store),
        multiGet: async (keys: string[]) => keys.map(k => [k, store[k] ?? null]),
        multiSet: async (entries: [string, string][]) => {
          for (const [k, v] of entries) store[k] = v;
          return null;
        },
        multiRemove: async (keys: string[]) => {
          for (const k of keys) delete store[k];
          return null;
        },
      };
    })()
  : AsyncStorage;

import {authReducer} from '@/features/auth';
import {themeReducer} from '@/features/theme';
import {companionReducer} from '@/features/companion';
import documentReducer from '@/features/documents/documentSlice';
import {expensesReducer} from '@/features/expenses';
import {tasksReducer} from '@/features/tasks';
import appointmentsReducer from '@/features/appointments/appointmentsSlice';
import businessesReducer from '@/features/appointments/businessesSlice';

const persistConfig = {
  key: 'root',
  version: 3,
  storage: storageForPersist,
  whitelist: ['auth', 'theme', 'documents', 'companion', 'expenses', 'tasks', 'appointments', 'businesses'],
  migrate: (state: any) => {
    console.log('[Redux Persist] Migrating state from version', state?._persist?.version);
    // Handle migration from version 1 to 2
    if (state?._persist?.version === 1) {
      console.log('[Redux Persist] Migrating from v1 to v2 - adding companion state');
    }
    // Handle migration from version 2 to 3
    if (state?._persist?.version === 2) {
      console.log('[Redux Persist] Migrating from v2 to v3 - refreshing businesses data with descriptions');
      // Clear old businesses data to force fresh fetch with descriptions
      if (state.businesses) {
        state.businesses = {
          businesses: [],
          employees: [],
          availability: [],
          loading: false,
          error: null,
        };
      }
    }
    return Promise.resolve(state);
  },
};

const rootReducer = combineReducers({
  auth: authReducer,
  theme: themeReducer,
  companion: companionReducer,
  documents: documentReducer,
  expenses: expensesReducer,
  tasks: tasksReducer,
  appointments: appointmentsReducer,
  businesses: businessesReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
      immutableCheck: {
        warnAfter: 128, // Increase warning threshold from 32ms to 128ms
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
