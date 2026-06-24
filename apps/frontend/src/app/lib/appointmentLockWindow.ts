import type { EncounterMode } from '@/app/features/appointments/types/workspace';
import {
  DEFAULT_INPATIENT_LOCK_HOURS,
  DEFAULT_OUTPATIENT_LOCK_HOURS,
} from '@/app/lib/appointmentWorkspace';
import {
  getJsonStorageItem,
  removeStorageItem,
  setJsonStorageItem,
} from '@/app/lib/browserStorage';

const LOCK_WINDOW_STORAGE_KEY = 'yc_appointment_lock_window';

/** Inclusive bounds for an org's appointment lock/edit window (in hours). */
export const MIN_LOCK_HOURS = 1;
export const MAX_LOCK_HOURS = 720; // 30 days

export type AppointmentLockWindow = {
  outpatientHours: number;
  inpatientHours: number;
};

export const DEFAULT_LOCK_WINDOW: AppointmentLockWindow = {
  outpatientHours: DEFAULT_OUTPATIENT_LOCK_HOURS,
  inpatientHours: DEFAULT_INPATIENT_LOCK_HOURS,
};

const isValidHours = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MIN_LOCK_HOURS &&
  value <= MAX_LOCK_HOURS;

/** Clamp an arbitrary hours input into the allowed window. */
export const clampLockHours = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_OUTPATIENT_LOCK_HOURS;
  return Math.min(MAX_LOCK_HOURS, Math.max(MIN_LOCK_HOURS, Math.round(value)));
};

/** Read the saved lock window, falling back to the 24h defaults. */
export const getSavedLockWindow = (): AppointmentLockWindow => {
  const saved = getJsonStorageItem<Partial<AppointmentLockWindow>>(
    'local',
    LOCK_WINDOW_STORAGE_KEY
  );
  if (!saved) return { ...DEFAULT_LOCK_WINDOW };
  return {
    outpatientHours: isValidHours(saved.outpatientHours)
      ? saved.outpatientHours
      : DEFAULT_OUTPATIENT_LOCK_HOURS,
    inpatientHours: isValidHours(saved.inpatientHours)
      ? saved.inpatientHours
      : DEFAULT_INPATIENT_LOCK_HOURS,
  };
};

/** Persist the lock window (clamping each value) and broadcast the change. */
export const setSavedLockWindow = (window: AppointmentLockWindow): boolean => {
  const normalized: AppointmentLockWindow = {
    outpatientHours: clampLockHours(window.outpatientHours),
    inpatientHours: clampLockHours(window.inpatientHours),
  };
  const didPersist = setJsonStorageItem('local', LOCK_WINDOW_STORAGE_KEY, normalized);
  if (!didPersist || !globalThis.window) return false;

  globalThis.window.dispatchEvent(
    new CustomEvent('yc:appointment-lock-window-changed', { detail: normalized })
  );
  return true;
};

/** Clear the saved override, reverting to defaults. */
export const clearSavedLockWindow = (): boolean =>
  removeStorageItem('local', LOCK_WINDOW_STORAGE_KEY);

/** Resolve the lock-window hours for a given encounter mode. */
export const resolveLockHours = (
  mode: EncounterMode,
  window: AppointmentLockWindow = getSavedLockWindow()
): number => (mode === 'INPATIENT' ? window.inpatientHours : window.outpatientHours);
