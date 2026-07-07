'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'yc-theme';
const THEME_CHANGE_EVENT = 'yc-theme-change';

/** The current theme, read from the source of truth: <html data-theme>. */
const readTheme = (): Theme => {
  const attr = globalThis.document?.documentElement.dataset.theme;
  return attr === 'dark' ? 'dark' : 'light';
};

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
 * Light/dark theme controller for the marketing surface. The source of truth is the
 * `data-theme` attribute on <html> (set pre-paint in the root layout). This hook mirrors
 * it into React state for the toggle icon, follows OS changes while no explicit choice is
 * stored, and enables the flip transition shortly after first paint.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(readTheme());
    syncMetaThemeColor();

    // Enable the flip transition after first paint so the initial paint never animates.
    const readyTimer = globalThis.setTimeout(() => {
      globalThis.document.documentElement.dataset.themeReady = '1';
    }, 60);

    // Keep every toggle instance's icon in sync when any of them flips the theme.
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<{ theme: Theme }>).detail?.theme ?? readTheme();
      setTheme(next);
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

  return { theme, toggle };
}
