'use strict';

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { classifyNavigation, type DesktopConfig } from './navigation-policy';
import type { DesktopLogger } from '../utils/logger';

export const IPC_CHANNELS = [
  'yc:reload',
  'yc:open-in-browser',
  'yc:start-signin',
  'yc:start-telehealth',
  'yc:get-settings',
  'yc:set-settings',
  'yc:execute-command',
  'yc:get-palette-recents',
  'yc:close-palette',
  'yc:get-cache-status',
  'yc:clear-cache',
  'yc:get-cached-urls',
  'yc:get-sync-status',
  'yc:sync-now',
  'yc:clear-local-data',
  'yc:show-notification',
  'yc:authenticate-biometric',
  'yc:apply-theme',
  'yc:open-patient-window',
  'yc:cs-record',
  'yc:cs-export',
  'yc:audit-append',
  'yc:vault-save',
  'yc:vault-list',
  'yc:vault-get',
  'yc:vault-delete',
  'yc:vault-stats',
  'yc:vault-save-buffer',
  'yc:vault-export',
  'yc:vault-reveal-doc',
  'yc:vault-open',
  'yc:dea-register',
  'yc:get-palette-actions',
  'yc:get-cached-content',
  'yc:tabs-get',
  'yc:tab-new',
  'yc:tab-close',
  'yc:tab-activate',
  'yc:tab-move',
  'yc:tab-pin',
  'yc:tab-duplicate',
  'yc:tab-reopen-closed',
  'yc:tab-set-zoom',
  'yc:tab-search',
  'yc:find-in-page',
  'yc:stop-find-in-page',
  'yc:open-devtools',
  'yc:close-devtools',
  'yc:tab-toggle-mute',
  'yc:tab-get-preview',
  'yc:tab-detach',
  'yc:tab-set-orientation',
  'yc:tab-set-split',
  'yc:show-cheatsheet',
  'yc:get-last-seen-version',
  'yc:set-last-seen-version',
  'yc:get-app-version',
  'yc:dismiss-whats-new',
  'yc:clear-notification-badge',
] as const;
export type IpcChannel = (typeof IPC_CHANNELS)[number];
const TRUSTED_DESKTOP_PROTOCOL = 'yosemitecrew-desktop:';
const TRUSTED_DESKTOP_HOSTS = new Set(['loading', 'offline', 'welcome']);

// A handler may return a value or a promise; `unknown` already covers both
// (a bare `Promise<unknown> | unknown` collapses to `unknown`).
type IpcHandler = (event: IpcMainInvokeEvent, args: readonly unknown[]) => unknown;

interface IpcRegistryDeps {
  ipcMain: Pick<IpcMain, 'handle'>;
  config: DesktopConfig;
  localFileRoot: string;
  logger: DesktopLogger;
}

const channelSet = new Set<string>(IPC_CHANNELS);

const isAllowedLocalFile = (rawUrl: string, localFileRoot: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'file:') return false;
    const candidate = fileURLToPath(parsed);
    const relative = path.relative(localFileRoot, candidate);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  } catch {
    return false;
  }
};

export const isTrustedIpcSender = (
  event: Pick<IpcMainInvokeEvent, 'senderFrame'>,
  config: DesktopConfig,
  localFileRoot: string
): boolean => {
  const senderUrl = event.senderFrame?.url || '';
  if (senderUrl.startsWith('file:')) {
    return isAllowedLocalFile(senderUrl, localFileRoot);
  }
  try {
    const parsed = new URL(senderUrl);
    if (parsed.protocol === TRUSTED_DESKTOP_PROTOCOL) {
      return TRUSTED_DESKTOP_HOSTS.has(parsed.hostname);
    }
  } catch {
    return false;
  }
  return classifyNavigation(senderUrl, config).disposition === 'internal';
};

const ARG_CHANNELS = new Set([
  'yc:set-settings',
  'yc:execute-command',
  'yc:start-telehealth',
  'yc:show-notification',
  'yc:authenticate-biometric',
  'yc:open-patient-window',
  'yc:cs-record',
  'yc:cs-export',
  'yc:audit-append',
  'yc:vault-save',
  'yc:vault-list',
  'yc:vault-get',
  'yc:vault-delete',
  'yc:vault-save-buffer',
  'yc:vault-export',
  'yc:vault-reveal-doc',
  'yc:vault-open',
  'yc:dea-register',
  'yc:get-cached-content',
  'yc:tab-new',
  'yc:tab-close',
  'yc:tab-activate',
  'yc:tab-move',
  'yc:tab-pin',
  'yc:tab-duplicate',
  'yc:tab-reopen-closed',
  'yc:tab-set-zoom',
  'yc:tab-search',
  'yc:find-in-page',
  'yc:stop-find-in-page',
  'yc:tab-toggle-mute',
  'yc:tab-get-preview',
  'yc:tab-detach',
  'yc:tab-set-orientation',
  'yc:tab-set-split',
  'yc:set-last-seen-version',
]);

export const validateIpcRequest = (
  event: Pick<IpcMainInvokeEvent, 'senderFrame'>,
  channel: string,
  args: readonly unknown[],
  config: DesktopConfig,
  localFileRoot: string
): { ok: true } | { ok: false; reason: string } => {
  if (!channelSet.has(channel)) return { ok: false, reason: 'unknown-channel' };
  if (!ARG_CHANNELS.has(channel) && args.length > 0)
    return { ok: false, reason: 'unexpected-args' };
  if (!isTrustedIpcSender(event, config, localFileRoot))
    return { ok: false, reason: 'untrusted-sender' };
  return { ok: true };
};

export const createIpcRegistry = ({ ipcMain, config, localFileRoot, logger }: IpcRegistryDeps) => ({
  handle(channel: IpcChannel, handler: IpcHandler): void {
    ipcMain.handle(channel, async (event, ...args) => {
      const validation = validateIpcRequest(event, channel, args, config, localFileRoot);
      if (!validation.ok) {
        logger.warn('ipc_request_rejected', {
          channel,
          reason: validation.reason,
          senderUrl: event.senderFrame?.url,
        });
        return { ok: false, error: validation.reason };
      }

      try {
        return await handler(event, args);
      } catch (error) {
        logger.error('ipc_handler_failed', { channel, error });
        return { ok: false, error: 'handler-failed' };
      }
    });
  },
});
