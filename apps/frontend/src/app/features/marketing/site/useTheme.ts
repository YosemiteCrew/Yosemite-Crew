'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerTheme,
  readTheme,
  subscribeToThemeChange,
  toggleTheme,
  useThemeLifecycle,
} from '@/app/ui/theme/themeCore';

export type { Theme } from '@/app/ui/theme/themeCore';

/**
 * Light/dark theme controller for the marketing surface. The source of truth is the
 * `data-theme` attribute on <html> (set pre-paint in the root layout). This hook reads
 * it for the toggle icon (every applyTheme dispatches the shared change event, keeping
 * all instances in sync), follows OS changes while no explicit choice is stored, and
 * enables the flip transition shortly after first paint — all via the shared themeCore.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeToThemeChange, readTheme, getServerTheme);
  useThemeLifecycle();
  return { theme, toggle: toggleTheme };
}
