import { create } from 'zustand';

/**
 * Tracks the user's answer to the in-house cookie consent popup.
 *
 * Persisted to `localStorage.cookieConsentGiven` to stay backwards-compatible
 * with the original Cookies widget. The store is the single source of truth
 * so any component can reactively gate behaviour on consent status without
 * having to re-read localStorage.
 */

const STORAGE_KEY = 'cookieConsentGiven';

export type ConsentStatus = 'unknown' | 'granted' | 'denied';

type ConsentState = {
  status: ConsentStatus;
  grant: () => void;
  deny: () => void;
  /** Reads localStorage and hydrates state. Safe to call repeatedly. */
  hydrate: () => void;
};

const readFromStorage = (): ConsentStatus => {
  if (typeof globalThis.window === 'undefined') return 'unknown';
  try {
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') return 'granted';
    if (raw === 'false') return 'denied';
    return 'unknown';
  } catch {
    return 'unknown';
  }
};

const writeToStorage = (value: 'true' | 'false') => {
  if (typeof globalThis.window === 'undefined') return;
  try {
    globalThis.window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage not available (private mode, quota, etc.) */
  }
};

export const useConsentStore = create<ConsentState>()((set) => ({
  status: readFromStorage(),
  grant: () => {
    writeToStorage('true');
    set({ status: 'granted' });
  },
  deny: () => {
    writeToStorage('false');
    set({ status: 'denied' });
  },
  hydrate: () => {
    set({ status: readFromStorage() });
  },
}));
