/**
 * App lock state, in two slices.
 *
 * `appLock` holds the saved settings and is persisted. `appLockStatus` holds
 * whether the app is locked, covered or waiting on the OS prompt. It is left
 * out of the persist whitelist on purpose, so every cold start begins locked
 * and covered until the lock gate has checked whether the lock is on.
 */
import {createSlice, type PayloadAction} from '@reduxjs/toolkit';

import {
  DEFAULT_APP_LOCK_TIMEOUT_MS,
  isAppLockTimeoutOption,
} from './appLockLogic';

export interface AppLockSettings {
  enabled: boolean;
  timeoutMs: number;
  /** The account that turned the lock on. */
  ownerId: string | null;
}

export const initialAppLockSettings: AppLockSettings = {
  enabled: false,
  timeoutMs: DEFAULT_APP_LOCK_TIMEOUT_MS,
  ownerId: null,
};

const appLockSlice = createSlice({
  name: 'appLock',
  initialState: initialAppLockSettings,
  reducers: {
    appLockEnabled: (
      state,
      action: PayloadAction<{ownerId: string | null}>,
    ) => {
      state.enabled = true;
      state.ownerId = action.payload.ownerId;
    },
    appLockDisabled: state => {
      state.enabled = false;
      state.ownerId = null;
    },
    /** Ignores anything that is not one of the offered timeouts. */
    appLockTimeoutChanged: (state, action: PayloadAction<number>) => {
      if (isAppLockTimeoutOption(action.payload)) {
        state.timeoutMs = action.payload;
      }
    },
  },
});

export interface AppLockStatus {
  locked: boolean;
  covered: boolean;
  /** The OS prompt is open, so AppState changes come from the prompt. */
  authenticating: boolean;
}

export const initialAppLockStatus: AppLockStatus = {
  locked: true,
  covered: true,
  authenticating: false,
};

const appLockStatusSlice = createSlice({
  name: 'appLockStatus',
  initialState: initialAppLockStatus,
  reducers: {
    appLocked: state => {
      state.locked = true;
      state.covered = true;
    },
    /** Dispatch only after a successful unlock, or when the lock is off. */
    appUnlocked: state => {
      state.locked = false;
      state.covered = false;
      state.authenticating = false;
    },
    appCovered: state => {
      state.covered = true;
    },
    /** A locked app stays covered. */
    appUncovered: state => {
      state.covered = state.locked;
    },
    authenticatingChanged: (state, action: PayloadAction<boolean>) => {
      state.authenticating = action.payload;
    },
  },
});

export const {appLockEnabled, appLockDisabled, appLockTimeoutChanged} =
  appLockSlice.actions;
export const {
  appLocked,
  appUnlocked,
  appCovered,
  appUncovered,
  authenticatingChanged,
} = appLockStatusSlice.actions;

export const appLockReducer = appLockSlice.reducer;
export const appLockStatusReducer = appLockStatusSlice.reducer;
