'use strict';

import { type BrowserWindow } from 'electron';
import { deepLinkToUrl, type DesktopConfig } from '../core/navigation-policy';
import type { DesktopLogger } from '../utils/logger';
import { desktopLocalPage, desktopResourcePath } from './paths';

type DesktopPage =
  | 'loading'
  | 'offline'
  | 'welcome'
  | 'settings'
  | 'command-palette'
  | 'tabbar'
  | 'whats-new'
  | 'vault';

export const localPage = (page: DesktopPage): string => desktopLocalPage(page);

export const getIconPath = (): string => desktopResourcePath('icon.png');

export interface NavigationDeps {
  logger: DesktopLogger;
  config: DesktopConfig;
  mainWindow: BrowserWindow | null;
  tabMode: boolean;
  activeContents: () => Electron.WebContents | null;
}

export const loadStartUrl = (
  deps: NavigationDeps & {
    tabMode: boolean;
    activeContents: () => Electron.WebContents | null;
  }
): void => {
  const wc = deps.activeContents();
  if (wc) {
    deps.logger.info('navigation_home', { href: deps.config.startUrl.href });
    void wc.loadURL(deps.config.startUrl.href);
  }
};

export const showOfflinePage = (deps: NavigationDeps, reason: string): void => {
  const wc = deps.activeContents();
  if (!wc) return;
  deps.logger.warn('offline_page_shown', { reason });
  void wc.loadFile(localPage('offline'), { query: { reason: reason || '' } });
};

export const focusMainWindow = (mw: BrowserWindow | null): void => {
  if (!mw || mw.isDestroyed()) return;
  if (mw.isMinimized()) mw.restore();
  mw.focus();
};

export interface DeepLinkDeps {
  logger: DesktopLogger;
  config: DesktopConfig;
  mainWindow: BrowserWindow | null;
  activeContents: () => Electron.WebContents | null;
  focusMainWindow: (mw: BrowserWindow | null) => void;
}

export const handleDeepLink = (rawUrl: string, deps: DeepLinkDeps): string | null => {
  const href = deepLinkToUrl(rawUrl, deps.config);
  if (!href) {
    deps.logger.warn('deep_link_rejected', { rawUrl });
    return null;
  }
  deps.logger.info('deep_link_opened', { href });
  const wc = deps.activeContents();
  if (wc) {
    void wc.loadURL(href);
    deps.focusMainWindow(deps.mainWindow);
    return null;
  }
  return href;
};

export const consumePendingDeepLink = (pending: string | null, deps: DeepLinkDeps): void => {
  if (!pending || !deps.mainWindow || deps.mainWindow.isDestroyed()) return;
  void deps.activeContents()?.loadURL(pending);
};
