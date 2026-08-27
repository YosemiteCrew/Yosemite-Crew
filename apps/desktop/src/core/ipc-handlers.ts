'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, net, shell } from 'electron';
import { createIpcRegistry } from './ipc';
import { classifyNavigation, deepLinkToUrl, type getDesktopConfig } from './navigation-policy';
import { openExternal, secureWebPreferences } from '../shell/window-config';
import { applyThemeToWebContents, DEFAULT_ACCENT_COLOR } from '../ui/theming';
import {
  STREAM_TELEHEALTH_PROVIDER,
  parseTelehealthLaunchInput,
  type TelehealthLaunchIntent,
} from '../utils/telehealth';
import { BUILTIN_ACTIONS } from '../ui/command-palette';
import {
  DEFAULT_SETTINGS,
  type DesktopSettings,
  type SettingsStore,
} from '../utils/settings-store';
import type { AuditLog } from '../compliance/audit-log';
import {
  WITNESS_REQUIRED_ACTIONS,
  type ControlledSubstanceLogbook,
  type CsAction,
} from '../compliance/controlled-substance';
import type { DualWitnessLog } from '../compliance/dual-witness';
import type { DeaRegistrationTracker } from '../compliance/dea-registration';
import type { IpcMain as IpcMainType } from 'electron';
import type { DesktopLogger } from '../utils/logger';
import type { OfflineCache } from '../sync/offline-cache';
import type { NotificationManager } from '../ui/notifications';
import type { BiometricLock } from '../lifecycle/biometric-lock';
import type { DocumentVault } from '../utils/document-vault';
import type { SyncEngine, SyncResult } from '../sync/sync-engine';
import type { OfflineStore } from '../sync/offline-store';
import type { SyncStatusSummary } from '../sync/sync-status';
import type { RecentsStore } from '../ui/command-palette';

export interface IpcServices {
  config: ReturnType<typeof getDesktopConfig>;
  logger: DesktopLogger;
  localFileRoot: string;
  brandPrefix: string;
  productName: string;
  chromeStripHeight: number;
  verticalTabWidth: number;

  // Windows & tabs
  mainWindow: BrowserWindow | null;
  activeContents: () => Electron.WebContents | null;
  loadStartUrl: () => void;
  enterTabMode: (url: string) => void;
  // Leave tab mode and return to the welcome screen (used when the last tab is
  // closed).
  exitTabMode: () => void;
  runCommandAction: (id: string) => Promise<void>;
  tabMode: boolean;
  tabManager: {
    create: (url: string) => string;
    close: (id: string) => void;
    activate: (id: string) => boolean;
    getState: () => {
      tabs: Array<{ id: string; url: string; title?: string; zoom?: number }>;
      activeId: string | null;
    };
    move: (id: string, toIndex: number) => boolean;
    pin: (id: string, pinned: boolean) => boolean;
    duplicate: (id: string) => string | null;
    reopenClosed: () => string | null;
    updateMeta: (id: string, meta: Record<string, unknown>) => void;
    persist: () => string;
    restore: (raw: string) => void;
  } | null;
  tabViewHost: {
    create: (id: string, url: string) => void;
    destroy: (id: string) => void;
    get: (id: string) => Electron.WebContentsView | undefined;
    getWebContents: (id: string) => Electron.WebContents | undefined;
    setBounds: (id: string, bounds: Electron.Rectangle) => void;
    setZoom: (id: string, level: number) => void;
    toggleMute: (id: string) => boolean;
    destroyAll: () => void;
  } | null;
  attachedTabId: string | null;
  tabOrientation: 'horizontal' | 'vertical';
  splitId: string | null;
  tabChromeView: Electron.WebContentsView | null;
  layoutTabChrome: () => void;
  setTabSearch: (open: boolean) => void;
  setSplitTab: (id: string | null) => void;
  setTabOrientation: (mode: 'horizontal' | 'vertical') => void;
  saveSession: () => void;

  // Navigation policy shared with the main window / tab views, applied to any
  // standalone window the IPC layer opens (e.g. a detached tab) so it can't be
  // redirected to an external/blocked URL while staying in the desktop shell.
  onNavigate: (event: { preventDefault: () => void }, url: string) => void;
  onWindowOpen: (url: string) => Electron.WindowOpenHandlerResponse;

  // UI windows
  commandPaletteWindow: BrowserWindow | null;
  settingsWindow: BrowserWindow | null;
  openVaultWindow: () => void;
  navigateToDeepLink: (url: string) => void;

  // Services
  settingsStore: SettingsStore | null;
  applySettings: (s: DesktopSettings) => void;
  recentsStore: RecentsStore | null;
  offlineCache: OfflineCache | null;
  notificationManager: NotificationManager | null;
  biometricLock: BiometricLock | null;
  documentVault: DocumentVault | null;
  syncEngine: SyncEngine | null;
  offlineStore: OfflineStore | null;
  keyboardShortcutManager: {
    register: () => void;
    unregister: () => void;
  } | null;

  // Compliance
  auditLog: AuditLog | null;
  controlledSubstanceLog: ControlledSubstanceLogbook | null;
  dualWitnessLog: DualWitnessLog | null;
  csExport: {
    exportDailyLog: (date?: Date) => { rowCount: number; filePath: string } | null;
  } | null;
  deaTracker: DeaRegistrationTracker | null;

  // Sync state
  lastOfflineSyncResults: SyncResult[];
  lastOfflineSyncError: string | null;
  getSyncStatusSummary: () => SyncStatusSummary;
  runOfflineFullSync: () => Promise<SyncResult[]>;
  clearLocalDesktopData: () => Promise<Record<string, boolean | number>>;

  // Notification badge
  unreadCount: number;
  updateUnreadBadge: () => void;

  // Telehealth
  startTelehealth: (intent?: TelehealthLaunchIntent) => string;

  // Manual window drag from the tab bar (see windowDragBy in preload).
  moveWindowBy: (dx: number, dy: number) => void;
  // Caption-button controls for the frameless window (Windows/Linux).
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  // Action taken on the idle-lock screen. The main process owns the unlock
  // lifecycle; the lock page only asks for one of these two outcomes.
  idleUnlock: (mode: 'biometric' | 'password') => void;
}

const CS_ACTIONS = new Set(['dispense', 'administer', 'receive', 'waste', 'transfer', 'inventory']);
const CS_REQUIRED_FIELDS = [
  'drugName',
  'drugClass',
  'lotNumber',
  'unit',
  'veterinarianId',
  'veterinarianName',
];

/**
 * Whether two ids denote the same person for the purpose of refusing a
 * self-witness. Compares case- and whitespace-insensitively. This is only ever
 * used to REJECT, so being generous about what counts as the same person fails
 * safe; it is deliberately not used to decide what gets stored.
 */
const sameIdentity = (a: unknown, b: unknown): boolean =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

type CsRecordValidation = { ok: false; error: string } | { ok: true; needsWitness: boolean };

const requireNonEmptyStrings = (
  d: Record<string, unknown>,
  fields: readonly string[]
): string | null => {
  for (const f of fields) {
    const v = d[f];
    if (typeof v !== 'string' || v.trim() === '') return `missing-${f}`;
  }
  return null;
};

const validateCsRecordPayload = (d: Record<string, unknown>): CsRecordValidation => {
  const action = d.action;
  if (typeof action !== 'string' || !CS_ACTIONS.has(action))
    return { ok: false, error: 'invalid-action' };

  const missing = requireNonEmptyStrings(d, CS_REQUIRED_FIELDS);
  if (missing) return { ok: false, error: missing };

  const quantity = d.quantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity))
    return { ok: false, error: 'invalid-quantity' };
  if (action !== 'transfer' && action !== 'inventory' && quantity <= 0)
    return { ok: false, error: 'invalid-quantity' };

  // Destruction may not be recorded on one person's say-so. Without this the
  // channel accepted action:'waste' with no witness at all, and the record still
  // read back as witness-verified.
  const needsWitness = WITNESS_REQUIRED_ACTIONS.includes(action as CsAction);
  if (needsWitness) {
    const missingWitness = requireNonEmptyStrings(d, ['witnessId', 'witnessName']);
    if (missingWitness) return { ok: false, error: missingWitness };
    // The payload is renderer-controlled, so an exact comparison lets "vet-1"
    // and "vet-1 " through as two different people.
    //
    // Comparison and storage deliberately differ, and the asymmetry costs
    // something worth naming. Identity is decided case-insensitively, so a
    // veterinarian cannot witness for themselves by changing case. Storage only
    // trims: these ids come from an external identity system that may well
    // treat case as significant, and lowercasing on the way to disk would
    // corrupt the identifier used to match a real person. The consequence is
    // that "Vet-1" and "vet-1" count as one person for this check while being
    // stored as written, which is the safer direction to be wrong in.
    d.witnessId = String(d.witnessId).trim();
    d.veterinarianId = String(d.veterinarianId).trim();
    d.witnessName = String(d.witnessName).trim();
    if (sameIdentity(d.witnessId, d.veterinarianId))
      return { ok: false, error: 'witness-must-differ' };
  }

  return { ok: true, needsWitness };
};

export const registerIpc = (services: IpcServices, ipc: IpcMainType = ipcMain): void => {
  const registry = createIpcRegistry({
    ipcMain: ipc,
    config: services.config,
    localFileRoot: services.localFileRoot,
    logger: services.logger,
  });

  registry.handle('yc:reload', async () => {
    services.loadStartUrl();
    return { ok: true };
  });
  registry.handle('yc:open-in-browser', async () => {
    await openExternal(services.config.startUrl.href);
    return { ok: true };
  });
  registry.handle('yc:start-signin', async () => {
    services.logger.info('signin_started');
    if (services.tabMode) services.loadStartUrl();
    else services.enterTabMode(services.config.startUrl.href);
    return { ok: true };
  });

  registry.handle('yc:start-telehealth', async (_event, args) => {
    const parsed = parseTelehealthLaunchInput(args[0]);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const href = services.startTelehealth(parsed.intent);
    return { ok: true, href, provider: STREAM_TELEHEALTH_PROVIDER.id };
  });

  registry.handle('yc:get-settings', async () => {
    const store = services.settingsStore;
    if (!store) return { ok: false, error: 'settings-not-ready' };
    const settings = store.load();
    return { ok: true, settings };
  });

  registry.handle('yc:set-settings', async (_event, args) => {
    const store = services.settingsStore;
    if (!store) return { ok: false, error: 'settings-not-ready' };
    const partial = args[0];
    if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
      return { ok: false, error: 'invalid-settings' };
    }
    const updated = store.save(partial);
    services.applySettings(updated);
    return { ok: true, settings: updated };
  });

  registry.handle('yc:execute-command', async (_event, args) => {
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-command-id' };
    const action = BUILTIN_ACTIONS.find((a) => a.id === id);
    if (!action) {
      services.logger.warn('execute_command_unknown', { id });
      return { ok: false, error: 'unknown-command' };
    }
    services.logger.debug('execute_command', { id, label: action.label });

    if (services.commandPaletteWindow && !services.commandPaletteWindow.isDestroyed()) {
      services.commandPaletteWindow.close();
    }

    // Run the action via the command router supplied by main.ts. Passing it as a
    // service (rather than importing main.ts) avoids an import cycle.
    void services
      .runCommandAction(id)
      .catch((error) => services.logger.warn('execute_command_failed', { id, error }));
    return { ok: true };
  });

  registry.handle('yc:get-palette-recents', async () => {
    const store = services.recentsStore;
    if (!store) return { ok: true, recents: [] };
    return { ok: true, recents: store.load() };
  });

  registry.handle('yc:get-palette-actions', async () => {
    return { ok: true, actions: BUILTIN_ACTIONS };
  });

  registry.handle('yc:close-palette', async () => {
    if (services.commandPaletteWindow && !services.commandPaletteWindow.isDestroyed()) {
      services.commandPaletteWindow.close();
    }
    return { ok: true };
  });

  registry.handle('yc:get-cache-status', async () => {
    const cache = services.offlineCache;
    if (!cache) return { ok: false, error: 'cache-not-ready' };
    return { ok: true, stats: cache.getStats() };
  });

  registry.handle('yc:clear-cache', async () => {
    const cache = services.offlineCache;
    if (!cache) return { ok: false, error: 'cache-not-ready' };
    cache.clear();
    services.logger.info('offline_cache_cleared');
    return { ok: true };
  });

  registry.handle('yc:get-cached-urls', async () => {
    const cache = services.offlineCache;
    if (!cache) return { ok: true, urls: [] };
    const entries = cache.entries().map((e) => ({
      url: e.url,
      title: e.headers?.['x-yc-title'] || '',
      cachedAt: e.cachedAt,
    }));
    entries.sort((a, b) => b.cachedAt - a.cachedAt);
    return { ok: true, urls: entries };
  });

  registry.handle('yc:get-cached-content', async (_event, args) => {
    const cache = services.offlineCache;
    if (!cache) return { ok: false, error: 'cache-not-ready' };
    const url = args[0];
    if (typeof url !== 'string') return { ok: false, error: 'invalid-url' };
    const entry = cache.get(url);
    if (!entry) return { ok: false, error: 'not-found' };
    return {
      ok: true,
      content: entry.body.toString('base64'),
      contentType: entry.contentType,
      headers: entry.headers,
      cachedAt: entry.cachedAt,
    };
  });

  registry.handle('yc:get-sync-status', async () => ({
    ok: true,
    status: services.getSyncStatusSummary(),
    lastResults: services.lastOfflineSyncResults,
  }));

  registry.handle('yc:sync-now', async () => {
    if (!services.syncEngine)
      return {
        ok: false,
        error: 'sync-not-ready',
        status: services.getSyncStatusSummary(),
      };
    if (!net.isOnline())
      return {
        ok: false,
        error: 'offline',
        status: services.getSyncStatusSummary(),
      };
    const results = await services.runOfflineFullSync();
    services.logger.info('manual_sync_completed', {
      tables: results.length,
      errors: results.flatMap((r) => r.errors).length,
    });
    return {
      ok: services.lastOfflineSyncError === null,
      results,
      status: services.getSyncStatusSummary(),
      ...(services.lastOfflineSyncError ? { error: services.lastOfflineSyncError } : {}),
    };
  });

  registry.handle('yc:clear-local-data', async () => {
    const result = await services.clearLocalDesktopData();
    services.logger.info('local_data_cleared', result);
    services.loadStartUrl();
    return { ok: true, result };
  });

  registry.handle('yc:show-notification', async (_event, args) => {
    const mgr = services.notificationManager;
    if (!mgr) return { ok: false, error: 'manager-not-ready' };
    const opts = args[0];
    if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
      return { ok: false, error: 'invalid-args' };
    }
    const { title, body, url, silent } = opts as Record<string, unknown>;
    if (typeof title !== 'string' || typeof body !== 'string') {
      return { ok: false, error: 'title-and-body-required' };
    }
    const shown = mgr.show({
      title,
      body,
      url: typeof url === 'string' ? url : undefined,
      silent: silent === true,
    });
    if (shown) {
      services.unreadCount++;
      services.updateUnreadBadge();
    }
    return { ok: true, shown };
  });

  registry.handle('yc:clear-notification-badge', async () => {
    services.unreadCount = 0;
    services.updateUnreadBadge();
    return { ok: true };
  });

  registry.handle('yc:authenticate-biometric', async (_event, args) => {
    const bio = services.biometricLock;
    if (!bio) return { ok: false, error: 'biometric-not-ready' };
    if (!bio.isAvailable()) return { ok: false, error: 'biometric-not-available' };
    const reason = typeof args[0] === 'string' ? args[0] : 'Authenticate to unlock';
    const authenticated = await bio.authenticate(reason);
    return { ok: authenticated, authenticated };
  });

  registry.handle('yc:apply-theme', async () => {
    if (!services.mainWindow || services.mainWindow.isDestroyed())
      return { ok: false, error: 'no-window' };
    const settings = services.settingsStore?.load() || DEFAULT_SETTINGS;
    const color = settings.accentColor || DEFAULT_ACCENT_COLOR;
    const scale = settings.fontScale || 1;
    void applyThemeToWebContents(services.activeContents()!, color, scale);
    return { ok: true };
  });

  registry.handle('yc:cs-record', async (_event, args) => {
    if (!services.controlledSubstanceLog) return { ok: false, error: 'cs-not-ready' };
    const data = args[0];
    if (typeof data !== 'object' || data === null || Array.isArray(data))
      return { ok: false, error: 'invalid-data' };
    const d = data as Record<string, unknown>;

    const validation = validateCsRecordPayload(d);
    if (!validation.ok) return { ok: false, error: validation.error };

    // The verification flag is derived here from an actual PIN check and never
    // taken from the payload: a renderer must not be able to assert that a
    // witness was verified.
    const witnessPinVerified =
      validation.needsWitness &&
      services.dualWitnessLog !== null &&
      typeof d.witnessPin === 'string' &&
      services.dualWitnessLog.verifyWitnessPin(d.witnessId as string, d.witnessPin);

    // The PIN is a credential, not part of the record: it must not be persisted
    // into the logbook or echoed back to the caller.
    const rest = Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'witnessPin'));
    const tx = services.controlledSubstanceLog.record({
      ...(rest as Parameters<ControlledSubstanceLogbook['record']>[0]),
      witnessPinVerified,
    });
    services.logger.info('cs_recorded', {
      id: tx.id,
      drugName: tx.drugName,
      witnessPinVerified,
    });
    return { ok: true, transaction: tx, witnessPinVerified };
  });

  registry.handle('yc:cs-export', async (_event, args) => {
    if (!services.csExport) return { ok: false, error: 'cs-export-not-ready' };
    const dateArg = args[0];
    const date = typeof dateArg === 'string' ? new Date(dateArg) : new Date();
    if (Number.isNaN(date.getTime())) return { ok: false, error: 'invalid-date' };
    const result = services.csExport.exportDailyLog(date);
    return { ok: true, result };
  });

  registry.handle('yc:audit-append', async (_event, args) => {
    if (!services.auditLog) return { ok: false, error: 'audit-not-ready' };
    const entry = args[0];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
      return { ok: false, error: 'invalid-entry' };
    const created = services.auditLog.append(entry as Parameters<AuditLog['append']>[0]);
    services.logger.info('audit_appended', {
      id: created.id,
      action: created.action,
    });
    return { ok: true, entry: created };
  });

  registry.handle('yc:vault-save', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const filename = args[0];
    const content = args[1];
    const mimeType = args[2];
    if (typeof filename !== 'string' || typeof content !== 'string')
      return { ok: false, error: 'invalid-args' };
    const doc = services.documentVault.saveDocument(
      filename,
      content,
      typeof mimeType === 'string' ? mimeType : undefined
    );
    if ('error' in doc) return { ok: false, error: doc.error };
    return { ok: true, document: doc };
  });

  registry.handle('yc:vault-list', async () => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    return { ok: true, documents: services.documentVault.listDocuments() };
  });

  registry.handle('yc:vault-get', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const result = services.documentVault.getDocumentBuffer(id);
    if (!result) return { ok: false, error: 'not-found' };
    return { ok: true, document: result.doc, content: result.content };
  });

  registry.handle('yc:vault-delete', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const removed = services.documentVault.deleteDocument(id);
    if (!removed) return { ok: false, error: 'not-found' };
    return { ok: true };
  });

  registry.handle('yc:vault-stats', async () => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    return { ok: true, stats: services.documentVault.getStats() };
  });

  registry.handle('yc:vault-save-buffer', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const [filename, base64Content, mimeType] = args as [string, string, string];
    if (typeof filename !== 'string' || typeof base64Content !== 'string')
      return { ok: false, error: 'invalid-args' };
    const buf = Buffer.from(base64Content, 'base64');
    const doc = services.documentVault.saveDocumentBuffer(
      filename,
      buf,
      typeof mimeType === 'string' ? mimeType : undefined
    );
    if (!doc || 'error' in doc) return { ok: false, error: 'save-failed' };
    return { ok: true, document: doc };
  });

  registry.handle('yc:vault-export', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const result = services.documentVault.getDocumentBuffer(id);
    if (!result) return { ok: false, error: 'not-found' };
    const saveResult = await dialog.showSaveDialog({
      defaultPath: result.doc.filename,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return { ok: false, error: 'cancelled' };
    try {
      fs.writeFileSync(saveResult.filePath, result.content);
      return { ok: true, path: saveResult.filePath };
    } catch {
      return { ok: false, error: 'write-failed' };
    }
  });

  registry.handle('yc:vault-reveal-doc', async (_event, args) => {
    if (!services.documentVault) return { ok: false, error: 'vault-not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const result = services.documentVault.getDocumentBuffer(id);
    if (!result) return { ok: false, error: 'not-found' };
    const tempDir = app.getPath('temp');
    const revealDir = path.join(tempDir, 'yc-vault-reveal');
    fs.mkdirSync(revealDir, { recursive: true });
    // Sanitize the stored filename: strip any directory components and refuse
    // anything that would escape the reveal directory (path traversal).
    const safeName = path.basename(result.doc.filename);
    const revealPath = path.join(revealDir, safeName);
    if (path.dirname(revealPath) !== revealDir) {
      return { ok: false, error: 'invalid-filename' };
    }
    try {
      fs.writeFileSync(revealPath, result.content);
      shell.showItemInFolder(revealPath);
      return { ok: true, path: revealPath };
    } catch {
      return { ok: false, error: 'write-failed' };
    }
  });

  registry.handle('yc:vault-open', async () => {
    services.openVaultWindow();
    return { ok: true };
  });

  registry.handle('yc:dea-register', async (_event, args) => {
    if (!services.deaTracker) return { ok: false, error: 'dea-tracker-not-ready' };
    const reg = args[0];
    if (typeof reg !== 'object' || reg === null || Array.isArray(reg))
      return { ok: false, error: 'invalid-reg' };
    services.deaTracker.register(reg as Parameters<DeaRegistrationTracker['register']>[0]);
    services.logger.info('dea_registered', {
      deaNumber: (reg as Record<string, unknown>).deaNumber,
    });
    return { ok: true };
  });

  registry.handle('yc:open-patient-window', async (_event, args) => {
    const patientId = args[0];
    const rawName = args[1];
    if (typeof patientId !== 'string') return { ok: false, error: 'invalid-patient-id' };
    const windowTitle = typeof rawName === 'string' ? rawName : `Patient ${patientId}`;
    // The app routes a specific companion (patient) to /companions?companionId=<id>;
    // there is no /patients route.
    const url = deepLinkToUrl(
      `yosemitecrew://companions?companionId=${encodeURIComponent(patientId)}`,
      services.config
    );
    if (!url) return { ok: false, error: 'invalid-url' };

    if (!services.mainWindow || services.mainWindow.isDestroyed())
      return { ok: false, error: 'no-main-window' };

    const child = new BrowserWindow({
      width: 1024,
      height: 768,
      title: windowTitle,
      parent: services.mainWindow,
      webPreferences: secureWebPreferences(path.join(services.localFileRoot, 'preload.js')),
    });

    child.setMenuBarVisibility(false);
    void child.loadURL(url);

    child.on('page-title-updated', (event, title) => {
      event.preventDefault();
      const trimmed = (title || '').trim();
      const prefixPattern = services.brandPrefix.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      const hasBrand = new RegExp(prefixPattern, 'i').test(trimmed);
      if (hasBrand) {
        child.setTitle(trimmed);
      } else {
        child.setTitle(trimmed ? `${trimmed} — ${services.productName}` : services.productName);
      }
    });

    return { ok: true };
  });

  // ── Tab IPC handlers ──

  // Thumbnails for the tab-hover preview (see yc:tab-get-preview). Each entry
  // records the URL it was captured from: a tab that has since navigated (or
  // whose id was reused for another page) must not be shown the previous page's
  // thumbnail. Entries are dropped when the tab goes away.
  // A cached preview is a full screenshot of a page that may have shown patient
  // records. It is keyed by tab and validated against the tab's current URL
  // below, but a URL match alone does not mean the SESSION is still the same
  // one - a sign-out or an idle lock leaves the tab on the same address with
  // different (or no) content behind it. The timestamp bounds how long a
  // capture can outlive the state it was taken in.
  const TAB_PREVIEW_TTL_MS = 60_000;
  const tabPreviewCache = new Map<string, { url: string; dataUrl: string; capturedAt: number }>();

  const attachTabView = (id: string): void => {
    if (!services.tabViewHost || !services.mainWindow || services.mainWindow.isDestroyed()) return;
    const tabViewHost = services.tabViewHost;
    if (services.attachedTabId && services.attachedTabId !== id) {
      const oldView = tabViewHost.get(services.attachedTabId);
      if (oldView) services.mainWindow.contentView.removeChildView(oldView);
    }
    const newView = tabViewHost.get(id);
    if (newView) services.mainWindow.contentView.addChildView(newView);
    const b = services.mainWindow.getContentBounds();
    const isV = services.tabOrientation === 'vertical';
    const x = isV ? services.verticalTabWidth : 0;
    const y = isV ? 0 : services.chromeStripHeight;
    const contentBounds = {
      x,
      y,
      width: Math.max(0, b.width - (isV ? services.verticalTabWidth : 0)),
      height: Math.max(0, b.height - (isV ? 0 : services.chromeStripHeight)),
    };
    tabViewHost.setBounds(id, contentBounds);
    services.attachedTabId = id;
    // Keep the tab-bar chrome view on TOP of the content view. Input is routed to
    // the topmost sibling WebContentsView, so the content view we just added would
    // otherwise capture every click/hover meant for the tabs and the
    // new-tab/search/close controls. A bare addChildView on an already-attached
    // view does not reliably re-order it, so remove then re-add to force the
    // chrome strip back to the top of the stack.
    const chrome = services.tabChromeView;
    if (chrome && !chrome.webContents.isDestroyed()) {
      services.mainWindow.contentView.removeChildView(chrome);
      services.mainWindow.contentView.addChildView(chrome);
    }
  };

  const detachActiveTabView = (): void => {
    if (
      !services.attachedTabId ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return;
    const view = services.tabViewHost.get(services.attachedTabId);
    if (view) services.mainWindow.contentView.removeChildView(view);
    services.attachedTabId = null;
  };

  registry.handle('yc:tabs-get', async () => {
    if (!services.tabManager) return { ok: false, error: 'tabs-not-ready' };
    return {
      ok: true,
      ...services.tabManager.getState(),
      orientation: services.tabOrientation,
    };
  });

  registry.handle('yc:tab-new', async (_event, args) => {
    if (
      !services.tabManager ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return { ok: false, error: 'not-ready' };
    const url = typeof args[0] === 'string' ? args[0] : services.config.startUrl.href;
    const decision = classifyNavigation(url, services.config);
    if (decision.disposition !== 'internal') {
      return { ok: false, error: 'url-not-allowed' };
    }
    const id = services.tabManager.create(url);
    services.tabViewHost.create(id, url);
    attachTabView(id);
    services.saveSession();
    return { ok: true, id };
  });

  registry.handle('yc:tab-close', async (_event, args) => {
    if (
      !services.tabManager ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return { ok: false, error: 'not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    if (id === services.attachedTabId) detachActiveTabView();
    // Clear split state if the closed tab was the split pane, otherwise the
    // chrome keeps a stale split pointer to a destroyed tab.
    if (id === services.splitId) services.setSplitTab(null);
    tabPreviewCache.delete(id);
    services.tabViewHost.destroy(id);
    services.tabManager.close(id);
    const state = services.tabManager.getState();
    if (state.activeId) {
      attachTabView(state.activeId);
      services.saveSession();
    } else {
      // Last tab closed — leave tab mode and return to the welcome screen.
      services.exitTabMode();
    }
    return { ok: true };
  });

  registry.handle('yc:tab-activate', async (_event, args) => {
    if (
      !services.tabManager ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return { ok: false, error: 'not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const activated = services.tabManager.activate(id);
    if (!activated) return { ok: false, error: 'tab-not-found' };
    attachTabView(id);
    return { ok: true };
  });

  registry.handle('yc:tab-move', async (_event, args) => {
    if (!services.tabManager) return { ok: false, error: 'tabs-not-ready' };
    const [id, toIndex] = args as [string, number];
    if (typeof id !== 'string' || !Number.isInteger(toIndex))
      return { ok: false, error: 'invalid-args' };
    const moved = services.tabManager.move(id, toIndex);
    if (moved) services.saveSession();
    return { ok: moved };
  });

  registry.handle('yc:tab-pin', async (_event, args) => {
    if (!services.tabManager) return { ok: false, error: 'tabs-not-ready' };
    const [id, pinned] = args as [string, boolean];
    if (typeof id !== 'string' || typeof pinned !== 'boolean')
      return { ok: false, error: 'invalid-args' };
    const result = services.tabManager.pin(id, pinned);
    if (result) services.saveSession();
    return { ok: result };
  });

  registry.handle('yc:tab-duplicate', async (_event, args) => {
    if (
      !services.tabManager ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return { ok: false, error: 'not-ready' };
    const id = args[0];
    if (typeof id !== 'string') return { ok: false, error: 'invalid-id' };
    const existing = services.tabManager.getState().tabs.find((t) => t.id === id);
    if (!existing) return { ok: false, error: 'tab-not-found' };
    const dupId = services.tabManager.duplicate(id);
    if (!dupId) return { ok: false, error: 'duplicate-failed' };
    services.tabViewHost.create(dupId, existing.url);
    attachTabView(dupId);
    services.saveSession();
    return { ok: true, id: dupId };
  });

  registry.handle('yc:tab-reopen-closed', async () => {
    if (
      !services.tabManager ||
      !services.tabViewHost ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed()
    )
      return { ok: false, error: 'not-ready' };
    const id = services.tabManager.reopenClosed();
    if (!id) return { ok: false, error: 'nothing-to-reopen' };
    const state = services.tabManager.getState();
    const tab = state.tabs.find((t) => t.id === id);
    if (tab) {
      services.tabViewHost.create(id, tab.url);
      attachTabView(id);
    }
    services.saveSession();
    return { ok: true, id };
  });

  registry.handle('yc:tab-search', async (_event, args) => {
    services.setTabSearch(args[0] === true);
    return { ok: true };
  });

  registry.handle('yc:tab-set-zoom', async (_event, args) => {
    if (!services.tabManager || !services.tabViewHost)
      return { ok: false, error: 'tabs-not-ready' };
    const [id, level] = args as [string, number];
    if (typeof id !== 'string' || typeof level !== 'number')
      return { ok: false, error: 'invalid-args' };
    const clamped = Math.max(0.1, Math.min(5, level));
    services.tabManager.updateMeta(id, { zoom: clamped });
    services.tabViewHost.setZoom(id, clamped);
    services.saveSession();
    return { ok: true };
  });

  registry.handle('yc:find-in-page', async (_event, args) => {
    const opts = args[0] as { text: string; forward?: boolean; matchCase?: boolean } | undefined;
    if (!opts || typeof opts.text !== 'string') return { ok: false, error: 'invalid-args' };
    const wc = services.activeContents();
    if (!wc) return { ok: false, error: 'no-active-content' };
    const requestId = wc.findInPage(opts.text, {
      forward: opts.forward !== false,
      matchCase: opts.matchCase === true,
    });
    return { ok: true, requestId };
  });

  registry.handle('yc:stop-find-in-page', async () => {
    const wc = services.activeContents();
    if (!wc) return { ok: false, error: 'no-active-content' };
    wc.stopFindInPage('clearSelection');
    return { ok: true };
  });

  registry.handle('yc:open-devtools', async () => {
    const wc = services.activeContents();
    if (!wc) return { ok: false, error: 'no-active-content' };
    if (!wc.isDevToolsOpened()) wc.openDevTools();
    return { ok: true };
  });

  registry.handle('yc:close-devtools', async () => {
    const wc = services.activeContents();
    if (!wc) return { ok: false, error: 'no-active-content' };
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    return { ok: true };
  });

  registry.handle('yc:tab-toggle-mute', async (_event, args) => {
    const [id] = args as [string];
    if (!services.tabViewHost || typeof id !== 'string')
      return { ok: false, error: 'invalid-args' };
    const ok = services.tabViewHost.toggleMute(id);
    return { ok };
  });

  // Thumbnails for the tab-hover preview. capturePage() forces a WebContentsView
  // to render, so capturing a background tab (parked offscreen at 0x0) flickers
  // the UI. Only the visible (active) tab is captured live; its thumbnail is
  // cached so that when it later becomes a background tab, hovering still shows
  // the last-known preview without a flicker-inducing live capture.
  registry.handle('yc:tab-get-preview', async (_event, args) => {
    const [id] = args as [string];
    if (!services.tabViewHost || typeof id !== 'string')
      return { ok: false, error: 'invalid-args' };
    const wc = services.tabViewHost.getWebContents(id);
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'no-contents' };
    if (wc !== services.activeContents()) {
      const cached = tabPreviewCache.get(id);
      if (!cached) return { ok: false, error: 'no-preview' };
      if (cached.url !== wc.getURL() || Date.now() - cached.capturedAt > TAB_PREVIEW_TTL_MS) {
        tabPreviewCache.delete(id);
        return { ok: false, error: 'no-preview' };
      }
      return { ok: true, dataUrl: cached.dataUrl };
    }
    try {
      const image = await wc.capturePage();
      const dataUrl = image.toDataURL();
      tabPreviewCache.set(id, {
        url: wc.getURL(),
        dataUrl,
        capturedAt: Date.now(),
      });
      return { ok: true, dataUrl };
    } catch {
      return { ok: false, error: 'capture-failed' };
    }
  });

  registry.handle('yc:tab-detach', async (_event, args) => {
    const [id] = args as [string];
    if (
      !services.tabViewHost ||
      !services.tabManager ||
      !services.mainWindow ||
      services.mainWindow.isDestroyed() ||
      typeof id !== 'string'
    )
      return { ok: false, error: 'not-ready' };
    const wc = services.tabViewHost.getWebContents(id);
    const url = wc && !wc.isDestroyed() ? wc.getURL() : '';
    const state = services.tabManager.getState();
    const tab = state.tabs.find((t) => t.id === id);
    if (!tab) return { ok: false, error: 'tab-not-found' };
    if (id === services.splitId) services.setSplitTab(null);
    tabPreviewCache.delete(id);
    services.tabManager.close(id);
    services.tabViewHost.destroy(id);
    services.saveSession();
    if (services.attachedTabId === id) {
      services.attachedTabId = null;
      const s = services.tabManager.getState();
      const nextId = s.activeId || s.tabs[0]?.id || null;
      if (nextId && services.tabViewHost.get(nextId)) {
        services.attachedTabId = nextId;
        services.mainWindow.contentView.addChildView(services.tabViewHost.get(nextId)!);
      }
      services.layoutTabChrome();
    }
    const detachUrl = url || tab.url || services.config.startUrl.href;
    const detachWin = new BrowserWindow({
      width: 1024,
      height: 700,
      title: tab.title || services.productName,
      minWidth: 400,
      minHeight: 300,
      webPreferences: secureWebPreferences(path.join(services.localFileRoot, 'preload.js')),
    });
    // Apply the same navigation policy the main window and tab views use, so the
    // detached window can't be redirected to an external/blocked URL in place or
    // spawn an uncontrolled popup.
    detachWin.webContents.on('will-navigate', services.onNavigate);
    detachWin.webContents.on('will-redirect', services.onNavigate);
    detachWin.webContents.setWindowOpenHandler(({ url: targetUrl }) =>
      services.onWindowOpen(targetUrl)
    );
    void detachWin.loadURL(detachUrl);
    return { ok: true };
  });

  registry.handle('yc:tab-set-orientation', async (_event, args) => {
    const [mode] = args as [string];
    if (mode !== 'horizontal' && mode !== 'vertical') return { ok: false, error: 'invalid-mode' };
    services.setTabOrientation(mode);
    return { ok: true };
  });

  registry.handle('yc:tab-set-split', async (_event, args) => {
    const [id] = args as [string | null];
    if (!services.tabManager || !services.tabViewHost)
      return { ok: false, error: 'tabs-not-ready' };
    if (id === null || id === undefined) {
      services.setSplitTab(null);
      return { ok: true };
    }
    if (typeof id !== 'string' || !services.tabViewHost.get(id))
      return { ok: false, error: 'invalid-tab' };
    services.setSplitTab(id);
    return { ok: true };
  });

  registry.handle('yc:show-cheatsheet', async () => {
    if (services.tabChromeView && !services.tabChromeView.webContents.isDestroyed()) {
      services.setTabSearch(true);
      void services.tabChromeView.webContents
        .executeJavaScript('window.__ycOpenCheatsheet && window.__ycOpenCheatsheet()')
        .catch((error) => services.logger.warn('cheatsheet_js_failed', { error }));
    }
    return { ok: true };
  });

  registry.handle('yc:get-app-version', async () => {
    return app.getVersion();
  });

  registry.handle('yc:get-last-seen-version', async () => {
    return services.settingsStore?.load().lastSeenVersion ?? '';
  });

  registry.handle('yc:set-last-seen-version', async (_event, args) => {
    const [v] = args as [string];
    services.settingsStore?.save({ lastSeenVersion: v });
    return { ok: true };
  });

  registry.handle('yc:dismiss-whats-new', async () => {
    services.settingsStore?.save({ lastSeenVersion: app.getVersion() });
    if (services.mainWindow && !services.mainWindow.isDestroyed()) {
      if (services.tabMode) {
        services.loadStartUrl();
      } else {
        services.enterTabMode(services.config.startUrl.href);
      }
    }
    return { ok: true };
  });

  // Fire-and-forget channel: the tab bar streams pointer deltas here while the
  // user drags the empty area, moving the frameless window manually (a child
  // WebContentsView can't use native -webkit-app-region drag without breaking the
  // tab controls). Invalid/non-finite deltas are ignored.
  registry.on('yc:window-drag-by', (_event, args) => {
    const [dx, dy] = args;
    if (typeof dx !== 'number' || typeof dy !== 'number') return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (dx === 0 && dy === 0) return;
    services.moveWindowBy(dx, dy);
  });

  // Fire-and-forget caption-button controls for the frameless window. No args,
  // no return value; the main process acts on the current main window. They stay
  // out of ARG_CHANNELS, so the registry drops any message that carries args as
  // well as any from an untrusted sender.
  registry.on('yc:window-minimize', () => services.minimizeWindow());
  registry.on('yc:window-toggle-maximize', () => services.toggleMaximizeWindow());
  registry.on('yc:window-close', () => services.closeWindow());

  // Fire-and-forget: the lock page asks to retry Touch ID or to fall back to
  // signing in with a password. Anything but those two modes is dropped.
  registry.on('yc:idle-unlock', (_event, args) => {
    const [mode] = args;
    if (mode !== 'biometric' && mode !== 'password') return;
    services.idleUnlock(mode);
  });
};
