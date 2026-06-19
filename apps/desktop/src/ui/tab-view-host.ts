'use strict';

import {
  WebContentsView,
  type Rectangle,
  type WebContents,
  type BrowserWindowConstructorOptions,
  type WindowOpenHandlerResponse,
} from 'electron';
import type { DesktopLogger } from '../utils/logger';

interface TabMetaUpdate {
  url?: string;
  title?: string;
  favicon?: string;
  loading?: boolean;
  error?: string | null;
  offline?: boolean;
  zoom?: number;
  audible?: boolean;
  muted?: boolean;
}

interface TabViewHostDeps {
  logger: DesktopLogger;
  webPreferences: NonNullable<BrowserWindowConstructorOptions['webPreferences']>;
  onUpdate?: (id: string, meta: TabMetaUpdate) => void;
  getZoom?: (id: string) => number;
  // Navigation policy (shared with the main window). When omitted, popups are
  // denied and in-place navigation is unrestricted (test/back-compat default).
  onWindowOpen?: (url: string) => WindowOpenHandlerResponse;
  onNavigate?: (event: { preventDefault: () => void }, url: string) => void;
  // Surface a main-frame load failure (real network error, not a deliberate
  // abort) so the shell can show its offline/retry page instead of leaving the
  // user on a blank or stuck tab with no recovery path.
  onLoadError?: (id: string, info: { url: string; error: string; code: number }) => void;
  // Fires after a tab finishes loading so the shell can populate the offline
  // cache from the tab's webContents (mirroring the main window). The current
  // HTTP status of the last main-frame navigation is provided so error pages are
  // not cached as good documents.
  onDidFinishLoad?: (id: string, wc: WebContents, httpStatus: number) => void;
}

interface TabView {
  id: string;
  view: WebContentsView;
  url: string;
}

export interface TabViewHost {
  create(id: string, url: string): WebContentsView;
  attach(id: string, bounds: Rectangle): void;
  detach(id: string): void;
  destroy(id: string): boolean;
  setBounds(id: string, bounds: Rectangle): boolean;
  get(id: string): WebContentsView | undefined;
  getUrl(id: string): string;
  destroyAll(): void;
  setZoom(id: string, level: number): boolean;
  toggleMute(id: string): boolean;
  getWebContents(id: string): Electron.WebContents | undefined;
  extract(id: string): WebContentsView | undefined;
}

export const createTabViewHost = (deps: TabViewHostDeps): TabViewHost => {
  const views = new Map<string, TabView>();

  return {
    create(id: string, url: string): WebContentsView {
      const existing = views.get(id);
      if (existing) return existing.view;

      const view = new WebContentsView({
        webPreferences: { ...deps.webPreferences },
      });

      view.webContents.loadURL(url).catch((err: Error) => {
        deps.logger.warn('tab_view_load_failed', {
          id,
          url,
          error: err.message,
        });
      });

      views.set(id, { id, view, url });

      view.webContents.on('page-title-updated', (_event, title) => {
        deps.logger.debug('tab_title_updated', { id, title });
        deps.onUpdate?.(id, { title });
      });

      view.webContents.on('page-favicon-updated', (_event, favicons) => {
        const favicon = favicons?.[0] || '';
        deps.logger.debug('tab_favicon_updated', { id, favicon });
        deps.onUpdate?.(id, { favicon });
      });

      // Keep the stored URL (and the TabManager) in sync as the user navigates,
      // so duplicate/reopen/session-restore reopen the current page, not the
      // page the tab was created with.
      const syncUrl = (navUrl: string): void => {
        const entry = views.get(id);
        if (entry) entry.url = navUrl;
        deps.onUpdate?.(id, { url: navUrl });
      };
      // Track the HTTP status of the last main-frame navigation so the offline
      // cache (populated via onDidFinishLoad) never stores a 4xx/5xx error page
      // as if it were a good document — did-finish-load fires for error pages too.
      let lastMainFrameStatus = 0;
      view.webContents.on('did-navigate', (_event, navUrl, httpResponseCode) => {
        lastMainFrameStatus = typeof httpResponseCode === 'number' ? httpResponseCode : 0;
        syncUrl(navUrl);
      });
      view.webContents.on('did-navigate-in-page', (_event, navUrl, isMainFrame) => {
        if (isMainFrame) syncUrl(navUrl);
      });

      if (deps.onDidFinishLoad) {
        view.webContents.on('did-finish-load', () => {
          if (view.webContents.isDestroyed()) return;
          deps.onDidFinishLoad!(id, view.webContents, lastMainFrameStatus);
        });
      }

      view.webContents.on('did-start-loading', () => {
        deps.logger.debug('tab_start_loading', { id });
        deps.onUpdate?.(id, { loading: true, error: null });
      });

      view.webContents.on('did-stop-loading', () => {
        deps.logger.debug('tab_stop_loading', { id });
        deps.onUpdate?.(id, { loading: false });
        const zoom = deps.getZoom?.(id);
        if (typeof zoom === 'number' && zoom > 0) {
          // `zoom` is a zoom FACTOR (1.0 = 100%).
          view.webContents.setZoomFactor(zoom);
        }
      });

      view.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          deps.logger.warn('tab_fail_load', { id, error: errorDescription });
          deps.onUpdate?.(id, { error: errorDescription, loading: false });
          // errorCode -3 is ERR_ABORTED, fired on intentional redirect/cancel
          // (e.g. an external link handed off by the nav policy) — not a real
          // failure. Only surface genuine main-frame load failures.
          if (isMainFrame && errorCode !== -3) {
            deps.onLoadError?.(id, {
              url: validatedURL,
              error: errorDescription,
              code: errorCode,
            });
          }
        }
      );

      view.webContents.on('media-started-playing', () => {
        deps.logger.debug('tab_media_started', { id });
        deps.onUpdate?.(id, { audible: true });
      });

      view.webContents.on('media-paused', () => {
        deps.logger.debug('tab_media_paused', { id });
        deps.onUpdate?.(id, { audible: false });
      });

      // Mouse buttons 4/5 → back/forward history navigation
      view.webContents.on('input-event', (_event, input) => {
        const mi = input as { type: string; button?: number };
        if (mi.type === 'mouseUp' && mi.button !== undefined) {
          if (mi.button === 3) view.webContents.navigationHistory.goBack();
          else if (mi.button === 4) view.webContents.navigationHistory.goForward();
        }
      });

      // In-place navigation policy (external/dev routes → browser or blocked),
      // matching the main window.
      if (deps.onNavigate) {
        view.webContents.on('will-navigate', (event, navUrl) => deps.onNavigate!(event, navUrl));
        view.webContents.on('will-redirect', (event, navUrl) => deps.onNavigate!(event, navUrl));
      }

      view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        deps.logger.debug('tab_window_open', { id, url: targetUrl });
        if (deps.onWindowOpen) return deps.onWindowOpen(targetUrl);
        return { action: 'deny' };
      });

      return view;
    },

    attach(id: string, bounds: Rectangle): void {
      const tv = views.get(id);
      if (!tv) return;
      tv.view.setBounds(bounds);
    },

    detach(id: string): void {
      const tv = views.get(id);
      if (!tv) return;
      // WebContentsView can't truly be hidden, but setting bounds offscreen works
      tv.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    },

    destroy(id: string): boolean {
      const tv = views.get(id);
      if (!tv) return false;
      tv.view.webContents.close();
      views.delete(id);
      return true;
    },

    setBounds(id: string, bounds: Rectangle): boolean {
      const tv = views.get(id);
      if (!tv) return false;
      tv.view.setBounds(bounds);
      return true;
    },

    get(id: string): WebContentsView | undefined {
      return views.get(id)?.view;
    },

    getUrl(id: string): string {
      return views.get(id)?.url || '';
    },

    setZoom(id: string, factor: number): boolean {
      const tv = views.get(id);
      if (!tv) return false;
      tv.view.webContents.setZoomFactor(factor > 0 ? factor : 1);
      return true;
    },

    toggleMute(id: string): boolean {
      const tv = views.get(id);
      if (!tv) return false;
      const newMuted = !tv.view.webContents.isAudioMuted();
      tv.view.webContents.setAudioMuted(newMuted);
      deps.onUpdate?.(id, { muted: newMuted });
      return true;
    },

    getWebContents(id: string): WebContents | undefined {
      return views.get(id)?.view.webContents;
    },

    extract(id: string): WebContentsView | undefined {
      const tv = views.get(id);
      if (!tv) return undefined;
      views.delete(id);
      return tv.view;
    },

    destroyAll(): void {
      for (const [id] of views) {
        this.destroy(id);
      }
    },
  };
};
