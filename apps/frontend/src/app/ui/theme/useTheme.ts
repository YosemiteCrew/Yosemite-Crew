'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getServerTheme,
  readTheme,
  subscribeToThemeChange,
  toggleTheme,
  useThemeLifecycle,
  type Theme,
} from './themeCore';

export type { Theme } from './themeCore';

/**
 * Three-way appearance preference exposed to settings UIs. `auto` means "no explicit
 * choice stored — follow the OS"; `light`/`dark` are explicit, persisted choices.
 */
export type Appearance = 'auto' | 'light' | 'dark';

/** The current appearance preference, derived from the presence of an explicit stored choice. */
const readAppearance = (): Appearance => {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : 'auto';
  } catch {
    return 'auto';
  }
};

/** The theme the OS currently prefers. */
const osTheme = (): Theme =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** SSR always renders the default; the client re-reads the real value on hydration. */
const getServerAppearance = (): Appearance => 'auto';

/**
 * Light/dark theme controller for the PIMS app surface. The source of truth is the
 * `data-theme` attribute on <html> (set pre-paint in the app route-group layout) plus
 * the stored `yc-theme` choice. Both are read through useSyncExternalStore — every
 * applyTheme dispatches the shared change event, keeping all toggle instances in sync.
 * The hook follows OS changes while no explicit choice is stored, and enables the flip
 * transition shortly after first paint.
 *
 * It shares the `yc-theme` storage key and `yc-theme-change` event with the marketing
 * surface (via themeCore) so a single theme choice is honored across the whole product.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeToThemeChange, readTheme, getServerTheme);
  const appearance = useSyncExternalStore(
    subscribeToThemeChange,
    readAppearance,
    getServerAppearance
  );

  useThemeLifecycle();

  /**
   * Set the three-way appearance preference. `auto` clears the stored choice and
   * follows the OS from now on; `light`/`dark` persist an explicit choice. The change
   * is broadcast via the shared `yc-theme-change` event so every theme surface reacts.
   */
  const setAppearance = useCallback((next: Appearance) => {
    if (next === 'auto') {
      try {
        globalThis.localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {
        /* private mode: nothing persisted to clear */
      }
      applyTheme(osTheme(), false);
    } else {
      applyTheme(next, true);
    }
  }, []);

  return { theme, toggle: toggleTheme, appearance, setAppearance };
}
