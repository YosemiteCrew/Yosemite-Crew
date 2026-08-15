'use client';

import { useEffect } from 'react';

export type Theme = 'light' | 'dark';

/**
 * Storage key and broadcast event shared by every theme surface (PIMS app and
 * marketing site) so a single choice is honored across the whole product.
 */
export const THEME_STORAGE_KEY = 'yc-theme';
export const THEME_CHANGE_EVENT = 'yc-theme-change';

/** The current theme, read from the source of truth: <html data-theme>. */
export const readTheme = (): Theme => {
  const attr = globalThis.document?.documentElement.dataset.theme;
  return attr === 'dark' ? 'dark' : 'light';
};

/** Keep the browser-chrome color (mobile address bar) in step with the page surface. */
export const syncMetaThemeColor = () => {
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

export const applyTheme = (theme: Theme, persist: boolean) => {
  const root = globalThis.document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themeReady = '1';
  if (persist) {
    try {
      globalThis.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* private mode: fall back to OS following */
    }
  }
  syncMetaThemeColor();
  globalThis.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
};

/** Re-read theme state whenever any toggle instance broadcasts a change (for useSyncExternalStore). */
export const subscribeToThemeChange = (onStoreChange: () => void): (() => void) => {
  globalThis.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => globalThis.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
};

/** SSR always renders light; the client re-reads <html data-theme> on hydration. */
export const getServerTheme = (): Theme => 'light';

/** Flip the current theme and persist the explicit choice. */
export const toggleTheme = () => {
  const next: Theme = readTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
};

/**
 * Shared mount lifecycle for every theme hook: sync the meta theme-color, enable
 * the flip transition shortly after first paint (so the initial paint never
 * animates), and follow OS scheme changes while no explicit choice is stored.
 * applyTheme broadcasts the change event, so every subscribed instance re-reads.
 */
export function useThemeLifecycle() {
  useEffect(() => {
    syncMetaThemeColor();

    // Enable the flip transition after first paint so the initial paint never animates.
    const readyTimer = globalThis.setTimeout(() => {
      globalThis.document.documentElement.dataset.themeReady = '1';
    }, 60);

    // Follow OS changes only while the visitor hasn't explicitly chosen a theme.
    // applyTheme broadcasts the change event, so every subscribed instance re-reads.
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    const onOSChange = (event: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (!saved) {
        applyTheme(event.matches ? 'dark' : 'light', false);
      }
    };
    mq?.addEventListener('change', onOSChange);

    return () => {
      globalThis.clearTimeout(readyTimer);
      mq?.removeEventListener('change', onOSChange);
    };
  }, []);
}
