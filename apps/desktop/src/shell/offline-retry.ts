'use strict';

import { classifyNavigation, type DesktopConfig } from '../core/navigation-policy';
import type { DesktopLogger } from '../utils/logger';

// The slice of WebContents this needs. Narrow on purpose so a tab view, the
// main window's contents and a test double are all usable here.
export interface RetryContents {
  id: number;
  getURL(): string;
  loadURL(url: string): unknown;
  once(event: 'destroyed', listener: () => void): unknown;
}

export interface OfflineRetryDeps {
  config: DesktopConfig;
  logger: DesktopLogger;
  // file:// URL of the offline page. A recorded target only applies while the
  // webContents is still showing that page: the same IPC channels are reachable
  // from the welcome screen, which means "open the app", not "open the page a
  // tab failed on an hour ago".
  offlinePageUrl: string;
}

export interface OfflineRetryTargets {
  // Record the page a given webContents is about to show the offline page for,
  // and return the URL that a retry from it will load.
  remember(wc: RetryContents, failedUrl?: string): string;
  targetFor(wc: RetryContents): string;
  retry(sender: RetryContents): void;
}

// Remembers, per webContents, the page whose load failed, so the offline page's
// "Try again" reloads THAT page in THAT tab. The URL is resolved against the
// navigation allow-list when it is recorded and is never supplied by the
// renderer, so the retry path loads a URL the shell already trusts.
export const createOfflineRetryTargets = (deps: OfflineRetryDeps): OfflineRetryTargets => {
  const targets = new Map<number, string>();
  const allowed = (url: string): boolean =>
    !!url && classifyNavigation(url, deps.config).disposition === 'internal';

  const showingOfflinePage = (wc: RetryContents): boolean =>
    wc.getURL().startsWith(deps.offlinePageUrl);

  const targetFor = (wc: RetryContents): string =>
    (showingOfflinePage(wc) ? targets.get(wc.id) : undefined) ?? deps.config.startUrl.href;

  return {
    remember(wc, failedUrl) {
      // A failed navigation does not commit, so getURL() still reports the page
      // the tab was on. Prefer the URL the failure reported and fall back to it.
      const candidate = failedUrl && allowed(failedUrl) ? failedUrl : wc.getURL();
      const target = allowed(candidate) ? candidate : deps.config.startUrl.href;
      // A tab can go offline repeatedly; register the cleanup once.
      if (!targets.has(wc.id)) wc.once('destroyed', () => targets.delete(wc.id));
      targets.set(wc.id, target);
      return target;
    },
    targetFor,
    retry(sender) {
      const href = targetFor(sender);
      deps.logger.info('offline_retry', { href });
      void sender.loadURL(href);
    },
  };
};
