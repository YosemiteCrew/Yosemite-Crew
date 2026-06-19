'use strict';

export const IDLE_LOCK_ENV = 'YC_DESKTOP_IDLE_LOCK_MINUTES';

export interface IdleLockState {
  locked: boolean;
  lastActiveAtMs: number;
}

export type IdleLockAction =
  | { type: 'activity'; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'unlock'; nowMs: number };

export const idleLockMinutesFromEnv = (env: NodeJS.ProcessEnv = process.env): number | null => {
  const raw = env[IDLE_LOCK_ENV];
  if (!raw) return null;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(24 * 60, Math.ceil(minutes));
};

export const shouldLockAfterIdle = (
  lastActiveAtMs: number,
  nowMs: number,
  idleMinutes: number | null
): boolean => {
  if (!idleMinutes || idleMinutes <= 0 || nowMs < lastActiveAtMs) return false;
  return nowMs - lastActiveAtMs >= idleMinutes * 60_000;
};

export const reduceIdleLock = (
  state: IdleLockState,
  action: IdleLockAction,
  idleMinutes: number | null
): IdleLockState => {
  if (action.type === 'activity' || action.type === 'unlock') {
    return { locked: false, lastActiveAtMs: action.nowMs };
  }

  if (shouldLockAfterIdle(state.lastActiveAtMs, action.nowMs, idleMinutes)) {
    return { ...state, locked: true };
  }

  return state;
};
