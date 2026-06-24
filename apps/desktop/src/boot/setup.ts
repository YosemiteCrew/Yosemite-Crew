'use strict';

import * as Electron from 'electron';

const { app, Menu, Tray, nativeImage } = Electron;
import { createTrayMenuTemplate, type TrayQuickAction } from '../ui/tray';
import { createTelemetryClient, type TelemetryClient } from '../utils/telemetry';
import { createTelemetryHttpSink } from '../utils/telemetry-sink';
import type { DesktopLogger } from '../utils/logger';

export interface TrayDeps {
  productName: string;
  mainWindow: Electron.BrowserWindow | null;
  logger: DesktopLogger;
  iconPath: string;
  runCommandAction: (id: string) => Promise<void>;
  checkForUpdatesManually: (deps: { logger: DesktopLogger }) => Promise<unknown>;
}

export const setupTray = (deps: TrayDeps): Electron.Tray => {
  let tray: Electron.Tray;
  try {
    const image = nativeImage.createFromPath(deps.iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(image);
    tray.setToolTip(deps.productName);
    const buildQuickActions = (): TrayQuickAction[] => [
      {
        id: 'new-appointment',
        label: 'New appointment',
        click: () => void deps.runCommandAction('action-new-appointment'),
      },
      {
        id: 'find-patient',
        label: 'Find patient',
        click: () => void deps.runCommandAction('action-find-patient'),
      },
      {
        id: 'check-in',
        label: 'Check in patient',
        click: () => void deps.runCommandAction('action-check-in'),
      },
    ];
    const rebuild = (): void => {
      const template = createTrayMenuTemplate({
        isVisible: () =>
          Boolean(deps.mainWindow && !deps.mainWindow.isDestroyed() && deps.mainWindow.isVisible()),
        show: () => {
          if (deps.mainWindow && !deps.mainWindow.isDestroyed()) {
            deps.mainWindow.show();
            deps.mainWindow.focus();
          }
        },
        hide: () => {
          if (deps.mainWindow && !deps.mainWindow.isDestroyed()) deps.mainWindow.hide();
        },
        checkForUpdates: () => void deps.checkForUpdatesManually({ logger: deps.logger }),
        quit: () => app.quit(),
        quickActions: buildQuickActions(),
      });
      tray?.setContextMenu(Menu.buildFromTemplate(template));
    };
    rebuild();
    deps.mainWindow?.on('show', rebuild);
    deps.mainWindow?.on('hide', rebuild);
  } catch (error) {
    deps.logger.warn('tray_setup_failed', { error });
    throw error;
  }
  return tray!;
};

export interface TelemetryDeps {
  logger: DesktopLogger;
}

export const setupTelemetry = (deps: TelemetryDeps): TelemetryClient | null => {
  const endpoint = process.env.YC_DESKTOP_TELEMETRY_URL;
  if (!endpoint) return null;
  // Require HTTPS so usage events are never sent in cleartext, even if the
  // endpoint is supplied via managed/MDM config.
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    deps.logger.warn('telemetry_endpoint_invalid', { endpoint });
    return null;
  }
  if (parsed.protocol !== 'https:') {
    deps.logger.warn('telemetry_endpoint_insecure', { protocol: parsed.protocol });
    return null;
  }
  const client = createTelemetryClient(
    createTelemetryHttpSink({ endpoint, logger: deps.logger }),
    process.env,
    deps.logger
  );
  client.recordUsage('app_ready');
  return client;
};

// ── Compliance ──────────────────────────────────────────────────────────────

import { createAuditLog, type AuditLog } from '../compliance/audit-log';
import {
  createControlledSubstanceLogbook,
  type ControlledSubstanceLogbook,
} from '../compliance/controlled-substance';
import { createOfflineAuditTrail, type OfflineAuditTrail } from '../compliance/offline-audit-trail';
import {
  createDeaRegistrationTracker,
  type DeaRegistrationTracker,
} from '../compliance/dea-registration';
import { createDeaBiennialReminder, type DeaBiennialReminder } from '../compliance/dea-reminder';
import { createDualWitnessLog, type DualWitnessLog } from '../compliance/dual-witness';
import {
  createPmpSubmissionService,
  type PmpSubmissionService,
} from '../compliance/pmp-submission';
import { createCsDailyExport, type CsDailyExportService } from '../compliance/cs-export';

export interface ComplianceServices {
  auditLog: AuditLog | null;
  controlledSubstanceLog: ControlledSubstanceLogbook | null;
  offlineAuditTrail: OfflineAuditTrail | null;
  deaTracker: DeaRegistrationTracker | null;
  deaReminder: DeaBiennialReminder | null;
  dualWitnessLog: DualWitnessLog | null;
  pmpService: PmpSubmissionService | null;
  csExport: CsDailyExportService | null;
}

export interface ComplianceDeps {
  logger: DesktopLogger;
  userData: string;
}

export const setupCompliance = async (deps: ComplianceDeps): Promise<ComplianceServices> => {
  try {
    const auditLog = await createAuditLog(deps.userData);
    const controlledSubstanceLog = createControlledSubstanceLogbook(deps.userData, { auditLog });
    const offlineAuditTrail = createOfflineAuditTrail({ auditLog });
    const deaTracker = createDeaRegistrationTracker({
      storageDir: path.join(deps.userData, 'dea-registrations'),
    });
    const deaReminder = createDeaBiennialReminder({
      storagePath: path.join(deps.userData, 'dea-biennial.json'),
    });
    const dualWitnessLog = createDualWitnessLog({
      logbook: controlledSubstanceLog,
    });
    const pmpService = createPmpSubmissionService();
    const csExport = createCsDailyExport({
      logbook: controlledSubstanceLog,
      exportDir: path.join(deps.userData, 'cs-exports'),
    });
    deps.logger.info('compliance_initialized');
    return {
      auditLog,
      controlledSubstanceLog,
      offlineAuditTrail,
      deaTracker,
      deaReminder,
      dualWitnessLog,
      pmpService,
      csExport,
    };
  } catch (error) {
    deps.logger.error('compliance_init_failed', { error });
    return {
      auditLog: null,
      controlledSubstanceLog: null,
      offlineAuditTrail: null,
      deaTracker: null,
      deaReminder: null,
      dualWitnessLog: null,
      pmpService: null,
      csExport: null,
    };
  }
};

// ── Document Vault & Backup ─────────────────────────────────────────────────

import { createDocumentVault, type DocumentVault } from '../utils/document-vault';
import { createBackupService, type BackupService } from '../utils/backup';
import path from 'node:path';

export interface VaultServices {
  documentVault: DocumentVault | null;
  backupService: BackupService | null;
  backupTimer: ReturnType<typeof setInterval> | null;
}

export interface VaultDeps {
  logger: DesktopLogger;
  userData: string;
  safeStorage: {
    isEncryptionAvailable(): boolean;
    encryptString(s: string): Buffer;
    decryptString(b: Buffer): string;
  };
}

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const setupVaultAndBackup = (deps: VaultDeps): VaultServices => {
  const encryptionAvailable = (() => {
    try {
      return deps.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  })();
  const documentVault = createDocumentVault(deps.userData, {
    encryptString: encryptionAvailable
      ? (plain: string) => deps.safeStorage.encryptString(plain)
      : undefined,
    decryptString: encryptionAvailable
      ? (encrypted: Buffer) => deps.safeStorage.decryptString(encrypted)
      : undefined,
  });
  const backupService = createBackupService();
  backupService.setSchedule({ enabled: true, intervalMs: BACKUP_INTERVAL_MS });
  void (async () => {
    try {
      const result = await backupService.createBackup({
        sourcePaths: [deps.userData],
        destinationDir: path.join(deps.userData, 'backups'),
        maxBackups: 7,
      });
      deps.logger.info('backup_run', {
        success: result.success,
        fileCount: result.fileCount,
        error: result.error,
      });
    } catch (error) {
      deps.logger.warn('backup_failed', { error });
    }
  })();
  const backupTimer = setInterval(async () => {
    try {
      const result = await backupService.createBackup({
        sourcePaths: [deps.userData],
        destinationDir: path.join(deps.userData, 'backups'),
        maxBackups: 7,
      });
      deps.logger.info('backup_run', {
        success: result.success,
        fileCount: result.fileCount,
        error: result.error,
      });
    } catch (error) {
      deps.logger.warn('backup_failed', { error });
    }
  }, BACKUP_INTERVAL_MS);
  if (typeof backupTimer.unref === 'function') backupTimer.unref();
  return { documentVault, backupService, backupTimer };
};

// ── Offline Sync ────────────────────────────────────────────────────────────

import { createOfflineStore, type OfflineStore } from '../sync/offline-store';
import { createSyncEngine, type SyncEngine } from '../sync/sync-engine';

export interface OfflineSyncServices {
  offlineStore: OfflineStore | null;
  syncEngine: SyncEngine | null;
  offlineSyncTimer: ReturnType<typeof setInterval> | null;
}

export interface OfflineSyncDeps {
  logger: DesktopLogger;
  net: Electron.Net;
  endpoint: string | undefined;
}

export const setupOfflineSync = async (deps: OfflineSyncDeps): Promise<OfflineSyncServices> => {
  try {
    const offlineStore = await createOfflineStore();
    offlineStore.registerTable({
      name: 'mutations',
      columns: [
        { name: 'entityType', type: 'TEXT' },
        { name: 'payload', type: 'TEXT' },
      ],
    });
    const transport = {
      fetchChanges: async (): Promise<Record<string, unknown>[]> => [],
      upsertRows: async (
        table: string,
        rows: Record<string, unknown>[]
      ): Promise<{ success: boolean; errors?: string[] }> => {
        if (!deps.endpoint) return { success: false, errors: ['no sync endpoint configured'] };
        return new Promise((resolve) => {
          try {
            const req = deps.net.request({
              method: 'POST',
              url: `${deps.endpoint}/${encodeURIComponent(table)}`,
            });
            req.setHeader('content-type', 'application/json');
            req.on('response', (res) =>
              resolve({
                success: res.statusCode >= 200 && res.statusCode < 300,
              })
            );
            req.on('error', (error) => resolve({ success: false, errors: [String(error)] }));
            req.write(JSON.stringify(rows));
            req.end();
          } catch (error) {
            resolve({ success: false, errors: [String(error)] });
          }
        });
      },
    };
    const syncEngine = createSyncEngine({ store: offlineStore, transport });
    const flush = (): void => {
      if (!syncEngine || !deps.net.isOnline()) return;
      void syncEngine
        .fullSync(['mutations'])
        .catch((error) => deps.logger.warn('offline_sync_flush_failed', { error }));
    };
    const offlineSyncTimer = setInterval(flush, 60_000);
    if (typeof offlineSyncTimer.unref === 'function') offlineSyncTimer.unref();
    deps.logger.info('offline_sync_initialized', {
      endpointConfigured: Boolean(deps.endpoint),
    });
    return { offlineStore, syncEngine, offlineSyncTimer };
  } catch (error) {
    deps.logger.warn('offline_sync_init_failed', { error });
    return { offlineStore: null, syncEngine: null, offlineSyncTimer: null };
  }
};

// ── Native OS Surfaces ──────────────────────────────────────────────────────

import {
  createSecondaryDisplayManager,
  type SecondaryDisplayManager,
  type DisplayInfo,
} from '../ui/secondary-display';
import {
  createPrintService,
  createLabelPrintService,
  type PrintService,
  type LabelPrintService,
} from '../utils/printing';
import { createDockMenuTemplate } from '../platform/macos-niceties';
import { createJumpList, createWindowsNiceties } from '../platform/windows-niceties';
import fs from 'node:fs';

export interface NativeSurfacesServices {
  secondaryDisplays: SecondaryDisplayManager | null;
  printService: PrintService | null;
  labelPrintService: LabelPrintService | null;
}

export interface NativeSurfacesDeps {
  app: Electron.App;
  screen: Electron.Screen;
  BrowserWindow: typeof Electron.BrowserWindow;
  Menu: typeof Electron.Menu;
  secureWebPreferences: (
    preload: string
  ) => Electron.BrowserWindowConstructorOptions['webPreferences'];
  logger: DesktopLogger;
  mainWindow: Electron.BrowserWindow | null;
  focusMainWindow: () => void;
  activeContents: () => Electron.WebContents | null;
  checkForUpdatesManually: (deps: { logger: DesktopLogger }) => Promise<unknown>;
  cachedPrinterNames: string[];
  refreshPrinters: () => void;
}

export const setupNativeSurfaces = (deps: NativeSurfacesDeps): NativeSurfacesServices => {
  const secondaryDisplays = createSecondaryDisplayManager({
    getDisplays: (): DisplayInfo[] => {
      const primaryId = deps.screen.getPrimaryDisplay().id;
      return deps.screen.getAllDisplays().map((d) => ({
        id: String(d.id),
        bounds: d.bounds,
        isPrimary: d.id === primaryId,
        scaleFactor: d.scaleFactor,
      }));
    },
    createWindow: (cfg, display) => {
      const win = new deps.BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        fullscreen: true,
        webPreferences: deps.secureWebPreferences(path.join(__dirname, '..', 'preload.js')),
      });
      // Containment: this preload-bearing window must stay on its seed origin, so
      // an open redirect / XSS on the loaded page can't move it to attacker
      // content that would then inherit the bridge.
      const seedOrigin = (() => {
        try {
          return new URL(cfg.url).origin;
        } catch {
          return '';
        }
      })();
      const keepOnOrigin = (e: Electron.Event, navUrl: string): void => {
        let sameOrigin = false;
        try {
          sameOrigin = new URL(navUrl).origin === seedOrigin && seedOrigin !== '';
        } catch {
          sameOrigin = false;
        }
        if (!sameOrigin) e.preventDefault();
      };
      win.webContents.on('will-navigate', keepOnOrigin);
      win.webContents.on('will-redirect', keepOnOrigin);
      void win.loadURL(cfg.url);
      return String(win.id);
    },
    closeWindow: (id) => {
      const win = deps.BrowserWindow.getAllWindows().find((w) => String(w.id) === id);
      if (win) {
        win.close();
        return true;
      }
      return false;
    },
  });

  const printService = createPrintService({
    generatePdf: async (_html: string, outputPath: string) => {
      const wc = deps.activeContents();
      if (!wc) throw new Error('no-window');
      const data = await wc.printToPDF({});
      fs.writeFileSync(outputPath, data);
      return { path: outputPath, size: data.length, pages: 0 };
    },
  });
  const labelPrintService = createLabelPrintService({
    getPrinters: () => deps.cachedPrinterNames,
  });
  deps.refreshPrinters();

  if (process.platform === 'darwin' && deps.app.dock) {
    const template = createDockMenuTemplate({
      show: deps.focusMainWindow,
      checkForUpdates: () => void deps.checkForUpdatesManually({ logger: deps.logger }),
    });
    deps.app.dock.setMenu(
      deps.Menu.buildFromTemplate(template.map((i) => ({ label: i.label, click: i.click })))
    );
  }

  if (process.platform === 'win32') {
    try {
      const winNiceties = createWindowsNiceties({
        mainWindow: deps.mainWindow ?? undefined,
      });
      deps.logger.info('windows_niceties_ready', {
        version: winNiceties.getWindowsVersion(),
      });
      const categories = createJumpList('Yosemite Crew PIMS.exe');
      deps.app.setJumpList(
        categories.map((c) => ({
          type: 'tasks' as const,
          items: c.items.map((it) => ({
            type: 'task' as const,
            title: it.title,
            program: process.execPath,
            args: it.args,
          })),
        }))
      );
    } catch (error) {
      deps.logger.warn('windows_niceties_failed', { error });
    }
  }

  return { secondaryDisplays, printService, labelPrintService };
};
