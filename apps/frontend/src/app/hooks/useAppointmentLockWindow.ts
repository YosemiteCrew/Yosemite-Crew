'use client';
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_LOCK_WINDOW,
  getSavedLockWindow,
  type AppointmentLockWindow,
} from '@/app/lib/appointmentLockWindow';

const LOCK_WINDOW_EVENT = 'yc:appointment-lock-window-changed';

const subscribe = (onChange: () => void): (() => void) => {
  if (!globalThis.window) return () => {};
  globalThis.window.addEventListener(LOCK_WINDOW_EVENT, onChange);
  globalThis.window.addEventListener('storage', onChange);
  return () => {
    globalThis.window.removeEventListener(LOCK_WINDOW_EVENT, onChange);
    globalThis.window.removeEventListener('storage', onChange);
  };
};

// Cache the resolved snapshot so useSyncExternalStore gets a stable reference
// between reads (it bails on re-render only when the value is referentially equal).
let cached: AppointmentLockWindow = { ...DEFAULT_LOCK_WINDOW };

const getSnapshot = (): AppointmentLockWindow => {
  const next = getSavedLockWindow();
  if (
    next.outpatientHours !== cached.outpatientHours ||
    next.inpatientHours !== cached.inpatientHours
  ) {
    cached = next;
  }
  return cached;
};

const getServerSnapshot = (): AppointmentLockWindow => DEFAULT_LOCK_WINDOW;

/** Live-updating accessor for the org appointment lock/edit window preference. */
export const useAppointmentLockWindow = (): AppointmentLockWindow =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
