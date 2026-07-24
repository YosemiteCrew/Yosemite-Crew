'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Three-way appearance preference exposed to settings UIs. `auto` means "no explicit
 * choice stored — follow the OS"; `light`/`dark` are explicit, persisted choices.
 */
export type Appearance = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'yc-theme';
const THEME_CHANGE_EVENT = 'yc-theme-change';

/** The current theme, read from the source of truth: <html data-theme>. */
const readTheme = (): Theme => {
  const attr = globalThis.document?.documentElement.dataset.theme;
  return attr === 'dark' ? 'dark' : 'light';
};

/** The current appearance preference, derived from the presence of an explicit stored choice. */
const readAppearance = (): Appearance => {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : 'auto';
  } catch {
    return 'auto';
  }
};

/** The theme the OS currently prefers. */
const osTheme = (): Theme =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** Keep the browser-chrome color (mobile address bar) in step with the page surface. */
const syncMetaThemeColor = () => {
  const doc = globalThis.document;
  if (!doc) return;
  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    doc.head.appendChild(meta);
  }
  const page = globalThis.getComputedStyle(doc.documentElement).getPropertyValue('--page').trim();
  meta.setAttribute('content', page || (readTheme() === 'dark' ? '#201c18' : '#efe8dc'));
};

const applyTheme = (theme: Theme, persist: boolean) => {
  const root = globalThis.document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themeReady = '1';
  if (persist) {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode: fall back to OS following */
    }
  }
  syncMetaThemeColor();
  globalThis.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
};

/**
 * Light/dark theme controller for the PIMS app surface. The source of truth is the
 * `data-theme` attribute on <html> (set pre-paint in the app route-group layout). This
 * hook mirrors it into React state for the toggle icon, follows OS changes while no
 * explicit choice is stored, and enables the flip transition shortly after first paint.
 *
 * It shares the `yc-theme` storage key and `yc-theme-change` event with the marketing
 * surface so a single theme choice is honored across the whole product.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [appearanceState, setAppearanceState] = useState<Appearance>('auto');

  useEffect(() => {
    setTheme(readTheme());
    setAppearanceState(readAppearance());
    syncMetaThemeColor();

    // Enable the flip transition after first paint so the initial paint never animates.
    const readyTimer = globalThis.setTimeout(() => {
      globalThis.document.documentElement.dataset.themeReady = '1';
    }, 60);

    // Keep every toggle instance's icon in sync when any of them flips the theme.
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<{ theme: Theme }>).detail?.theme ?? readTheme();
      setTheme(next);
      setAppearanceState(readAppearance());
    };
    globalThis.addEventListener(THEME_CHANGE_EVENT, onThemeChange);

    // Follow OS changes only while the visitor hasn't explicitly chosen a theme.
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const onOSChange = (event: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = globalThis.localStorage.getItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (!saved) {
        applyTheme(event.matches ? 'dark' : 'light', false);
        setTheme(event.matches ? 'dark' : 'light');
        setAppearanceState('auto');
      }
    };
    mq?.addEventListener('change', onOSChange);

    return () => {
      globalThis.clearTimeout(readyTimer);
      globalThis.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
      mq?.removeEventListener('change', onOSChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    setTheme(next);
  }, []);

  /**
   * Set the three-way appearance preference. `auto` clears the stored choice and
   * follows the OS from now on; `light`/`dark` persist an explicit choice. The change
   * is broadcast via the shared `yc-theme-change` event so every theme surface reacts.
   */
  const setAppearance = useCallback((next: Appearance) => {
    if (next === 'auto') {
      try {
        globalThis.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* private mode: nothing persisted to clear */
      }
      const resolved = osTheme();
      applyTheme(resolved, false);
      setTheme(resolved);
    } else {
      applyTheme(next, true);
      setTheme(next);
    }
    setAppearanceState(next);
  }, []);

  return { theme, toggle, appearance: appearanceState, setAppearance };
}
