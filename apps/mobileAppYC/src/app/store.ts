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
const isJest =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined;
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
        multiGet: async (keys: string[]) =>
          keys.map(k => [k, store[k] ?? null]),
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
import passportReducer from '@/features/passport/passportSlice';
import {expensesReducer} from '@/features/expenses';
import {tasksReducer} from '@/features/tasks';
import appointmentsReducer from '@/features/appointments/appointmentsSlice';
import businessesReducer from '@/features/appointments/businessesSlice';
import {coParentReducer} from '@/features/coParent';
import {linkedBusinessesReducer} from '@/features/linkedBusinesses';
import {notificationReducer} from '@/features/notifications';
import formsReducer from '@/features/forms/formsSlice';
import preferencesReducer from '@/features/preferences/preferencesSlice';
import {assistantReducer} from '@/features/assistant';

const migrateV1ToV2 = (_state: any) => {
  console.log(
    '[Redux Persist] Migrating from v1 to v2 - adding companion state',
  );
};

const migrateV2ToV3 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v2 to v3 - refreshing businesses data with descriptions',
  );
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
};

const migrateV3ToV4 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v3 to v4 - adding notifications state',
  );
  // Initialize notifications state if not present
  if (!state.notifications) {
    state.notifications = {
      items: [],
      loading: false,
      error: null,
      unreadCount: 0,
      hydratedCompanions: {},
      filter: 'all',
      sortBy: 'new',
    };
  }
};

const migrateV4ToV5 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v4 to v5 - initializing service catalog',
  );
  if (state.businesses) {
    state.businesses.services = state.businesses.services ?? [];
  }
};

const migrateV5ToV6 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v5 to v6 - ensuring companion.companions is an array',
  );
  if (state.companion && !Array.isArray(state.companion.companions)) {
    state.companion.companions = [];
  }
};

const migrateV6ToV7 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v6 to v7 - adding preferences state',
  );
  if (!state.preferences) {
    state.preferences = {
      weightOverride: null,
      distanceOverride: null,
      currencyOverride: null,
    };
  }
};

const migrateV7ToV8 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v7 to v8 - adding list load-failure state',
  );
  // These slices gained a `failedCompanions` map so a failed list fetch stops
  // rendering as the new-user empty state. All of them are persisted, so state
  // written by an older build arrives without the key and the first fetch after
  // an upgrade would write through undefined.
  for (const key of ['tasks', 'appointments', 'expenses', 'notifications']) {
    if (state[key]) {
      state[key].hydratedCompanions = state[key].hydratedCompanions ?? {};
      state[key].failedCompanions = state[key].failedCompanions ?? {};
      state[key].activeRequests = state[key].activeRequests ?? {};
    }
  }
  if (state.companion) {
    state.companion.hasLoaded = state.companion.hasLoaded ?? false;
    state.companion.loadError = state.companion.loadError ?? null;
  }
};

const migrateV8ToV9 = (state: any) => {
  console.log(
    '[Redux Persist] Migrating from v8 to v9 - adding list staleness tracking',
  );
  // `activeRequests` discards rejections superseded by a newer success;
  // `lastLoadedAt` lets a stale list say how old it is. Both live on persisted
  // slices, so state written before them rehydrates without the keys.
  for (const key of ['tasks', 'appointments', 'expenses', 'notifications']) {
    if (state[key]) {
      state[key].activeRequests = state[key].activeRequests ?? {};
      state[key].lastLoadedAt = state[key].lastLoadedAt ?? {};
    }
  }
  if (state.expenses) {
    // Summary failures live apart from list failures: they retry different
    // fetches, so one entry cannot serve both.
    state.expenses.summaryFailedCompanions =
      state.expenses.summaryFailedCompanions ?? {};
  }
};

// Keyed by the persisted version a state is migrating FROM.
const MIGRATIONS_BY_FROM_VERSION: Record<number, (state: any) => void> = {
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
  5: migrateV5ToV6,
  6: migrateV6ToV7,
  7: migrateV7ToV8,
  8: migrateV8ToV9,
};

const PERSIST_VERSION = 9;

const persistConfig = {
  key: 'root',
  version: PERSIST_VERSION,
  storage: storageForPersist,
  whitelist: [
    'auth',
    'theme',
    'documents',
    'companion',
    'expenses',
    'tasks',
    'appointments',
    'businesses',
    'coParent',
    'linkedBusinesses',
    'notifications',
    'forms',
    'preferences',
  ],
  migrate: (state: any) => {
    const from = state?._persist?.version;
    console.log('[Redux Persist] Migrating state from version', from);

    // Run EVERY step from the persisted version up to the current one. This
    // used to apply a single step, so a user two or more versions behind kept
    // whatever shape they had and skipped the rest - the later a migration was
    // added, the fewer users it reached.
    if (typeof from === 'number') {
      for (let version = from; version < PERSIST_VERSION; version += 1) {
        MIGRATIONS_BY_FROM_VERSION[version]?.(state);
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
  passport: passportReducer,
  expenses: expensesReducer,
  tasks: tasksReducer,
  appointments: appointmentsReducer,
  businesses: businessesReducer,
  coParent: coParentReducer,
  linkedBusinesses: linkedBusinessesReducer,
  notifications: notificationReducer,
  forms: formsReducer,
  preferences: preferencesReducer,
  // Deliberately absent from `whitelist` below: the assistant transcript is a
  // conversation, not a record. It should not survive a relaunch, and keeping
  // it out of storage also keeps pet health chatter off disk.
  assistant: assistantReducer,
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
