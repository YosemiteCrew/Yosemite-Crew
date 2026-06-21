'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DesktopLogger } from '../utils/logger';
import type { AuditLog } from '../compliance/audit-log';
import type { CsDailyExportService } from '../compliance/cs-export';
import type { DeaBiennialReminder } from '../compliance/dea-reminder';
import type { DeaRegistrationTracker } from '../compliance/dea-registration';
import type { ControlledSubstanceLogbook } from '../compliance/controlled-substance';
import type { PmpSubmissionService } from '../compliance/pmp-submission';
import type { DualWitnessLog } from '../compliance/dual-witness';
import type { OfflineAuditTrail } from '../compliance/offline-audit-trail';
import type { DocumentVault } from '../utils/document-vault';
import type { BackupService } from '../utils/backup';
import type { SecondaryDisplayManager } from './secondary-display';
import type { PrintService, LabelPrintService } from '../utils/printing';
import type { DesktopConfig } from '../core/navigation-policy';
import type { BrowserWindow, WebContents } from 'electron';
import { generateDeaReport, formatDeaReport } from '../compliance/dea-report';
import {
  collectDiagnosticData,
  createDiagnosticBundle,
  readRecentLogEntries,
  writeDiagnosticZip,
} from '../utils/diagnostics';

export interface StatusDialogDeps {
  logger: DesktopLogger;
  dialog: Electron.Dialog;
  safeStorage: Electron.SafeStorage;
  screen: Electron.Screen;
  app: Electron.App;
  config: DesktopConfig;
  auditLog: AuditLog | null;
  csExport: CsDailyExportService | null;
  deaReminder: DeaBiennialReminder | null;
  deaTracker: DeaRegistrationTracker | null;
  controlledSubstanceLog: ControlledSubstanceLogbook | null;
  pmpService: PmpSubmissionService | null;
  dualWitnessLog: DualWitnessLog | null;
  offlineAuditTrail: OfflineAuditTrail | null;
  documentVault: DocumentVault | null;
  backupService: BackupService | null;
  runBackup: () => Promise<void>;
  mainWindow: BrowserWindow | null;
  secondaryDisplays: SecondaryDisplayManager | null;
  labelPrintService: LabelPrintService | null;
  printService: PrintService | null;
  activeContents: () => WebContents | null;
  refreshPrinters: () => void;
}

export interface StatusDialogService {
  verifyAuditTrail: () => void;
  exportCsDailyLog: () => void;
  showDeaStatus: () => void;
  generateDeaReportAction: () => void;
  showPmpStatus: () => void;
  showVaultInfo: () => void;
  backUpNow: () => Promise<void>;
  savePageAsPdf: () => Promise<void>;
  openOnSecondScreen: () => void;
  showPrintStatus: () => void;
  exportDiagnostics: (window: BrowserWindow | null) => Promise<void>;
}

export const createStatusDialogService = (deps: StatusDialogDeps): StatusDialogService => {
  const { dialog } = deps;

  const infoDialog = (message: string, detail: string): void => {
    void dialog.showMessageBox({
      type: 'info',
      message,
      detail,
      buttons: ['OK'],
    });
  };

  return {
    verifyAuditTrail: (): void => {
      if (!deps.auditLog) {
        infoDialog('Audit Trail', 'The audit log is not initialized.');
        return;
      }
      const { valid, tampered } = deps.auditLog.verifyAll();
      const chainIntact = deps.auditLog.verifyChain();
      infoDialog(
        'Audit Trail Integrity',
        `Total entries: ${deps.auditLog.size()}\nValid signatures: ${valid}\nTampered: ${tampered}\nHash chain intact: ${chainIntact ? 'yes' : 'NO'}`
      );
    },

    exportCsDailyLog: (): void => {
      if (!deps.csExport) {
        infoDialog('Controlled-Substance Export', 'The export service is not initialized.');
        return;
      }
      const result = deps.csExport.exportDailyLog();
      if (!result) {
        infoDialog(
          'Controlled-Substance Export',
          'No controlled-substance transactions to export for today.'
        );
        return;
      }
      infoDialog(
        'Controlled-Substance Export',
        `Exported ${result.rowCount} row(s) to:\n${result.filePath}`
      );
    },

    showDeaStatus: (): void => {
      const registrations = deps.deaTracker?.getAllRegistrations() ?? [];
      // Without this guard the reminder service reports "biennial report is due"
      // even when no DEA registration exists at all — a false compliance alarm.
      if (registrations.length === 0) {
        infoDialog(
          'DEA Compliance Status',
          'No DEA registrations are configured yet. Add a DEA registration to track renewal ' +
            'deadlines and biennial inventory reporting.'
        );
        return;
      }
      const reminder = deps.deaReminder?.getReminderMessage();
      const expiring = deps.deaTracker?.getExpiringSoon(60) ?? [];
      infoDialog(
        'DEA Compliance Status',
        `${reminder || 'Biennial inventory report is not due.'}\nRegistrations expiring within 60 days: ${expiring.length}`
      );
    },

    generateDeaReportAction: (): void => {
      if (!deps.controlledSubstanceLog) {
        dialog.showErrorBox('DEA Report', 'Controlled substance logbook is not initialized.');
        return;
      }
      const registrations = deps.deaTracker?.getAllRegistrations() ?? [];
      if (registrations.length === 0) {
        // Don't silently write a report with no registrant details — make the
        // empty-data case explicit and let the user back out.
        const proceed = dialog.showMessageBoxSync({
          type: 'warning',
          buttons: ['Cancel', 'Generate anyway'],
          defaultId: 0,
          cancelId: 0,
          message: 'No DEA registration configured',
          detail:
            'The biennial report would have no registrant details. Add a DEA registration first, or generate an empty template anyway.',
        });
        if (proceed !== 1) return;
      }
      const deaNumber = registrations[0]?.deaNumber || '';
      const report = generateDeaReport({
        logbook: deps.controlledSubstanceLog,
        facilityName: 'Your Practice',
        deaNumber,
      });
      const formats = [
        { name: 'JSON', extension: 'json' },
        { name: 'CSV', extension: 'csv' },
        { name: 'Text', extension: 'txt' },
      ] as const;
      // 'Cancel' is the last button; selecting it yields an out-of-range index so
      // `formats[formatIndex]` is undefined and we bail below.
      const formatIndex = dialog.showMessageBoxSync({
        type: 'question',
        buttons: [...formats.map((f) => f.name), 'Cancel'],
        defaultId: 0,
        cancelId: formats.length,
        message: 'Select DEA report format',
      });
      const selectedFormat = formats[formatIndex];
      if (!selectedFormat) return;
      const result = dialog.showSaveDialogSync({
        defaultPath: `dea-biennial-report.${selectedFormat.extension}`,
        filters: [{ name: selectedFormat.name, extensions: [selectedFormat.extension] }],
      });
      if (!result) return;
      try {
        const formatArg = selectedFormat.name.toLowerCase() as 'json' | 'csv' | 'text';
        const content = formatDeaReport(report, formatArg);
        fs.writeFileSync(result, content, 'utf8');
        deps.logger.info('dea_report_saved', {
          path: result,
          format: selectedFormat.name,
        });
      } catch (error) {
        deps.logger.error('dea_report_save_failed', { error });
        dialog.showErrorBox('DEA Report', 'Failed to save the report.');
      }
    },

    showPmpStatus: (): void => {
      infoDialog(
        'PMP Reporting',
        `This app prepares state-compliant PMP batch files for manual upload to your state's ` +
          `Prescription Monitoring Program portal. It does not transmit to the PMP automatically.\n\n` +
          `Records pending export: ${deps.pmpService?.getPending().length ?? 0}\n` +
          `Marked exported: ${deps.pmpService?.getSubmitted().length ?? 0}\n` +
          `Marked failed: ${deps.pmpService?.getFailed().length ?? 0}\n` +
          `Witnessed waste events: ${deps.dualWitnessLog?.getWasteEvents().length ?? 0}\n` +
          `Unsynced offline mutations: ${deps.offlineAuditTrail?.getUnsyncedCount() ?? 0}`
      );
    },

    showVaultInfo: (): void => {
      if (!deps.documentVault) {
        infoDialog('Document Vault', 'The document vault is not initialized.');
        return;
      }
      const stats = deps.documentVault.getStats();
      infoDialog(
        'Document Vault',
        `Stored documents: ${stats.count}\nTotal size: ${Math.round(stats.totalSizeBytes / 1024)} KB\n` +
          `Encryption: ${deps.safeStorage.isEncryptionAvailable() ? 'OS keychain (safeStorage)' : 'unavailable (plaintext fallback)'}`
      );
    },

    backUpNow: async (): Promise<void> => {
      if (!deps.backupService) {
        infoDialog('Backup', 'The backup service is not initialized.');
        return;
      }
      await deps.runBackup();
      const backups = deps.backupService.listBackups(deps.app.getPath('userData') + '/backups');
      const latest = backups[0];
      infoDialog(
        'Backup Complete',
        latest
          ? `Backed up ${latest.fileCount} file(s) (${Math.round(latest.size / 1024)} KB).\nTotal backups kept: ${backups.length}`
          : 'Backup finished.'
      );
    },

    savePageAsPdf: async (): Promise<void> => {
      if (!deps.mainWindow) {
        infoDialog('Save as PDF', 'No window is available.');
        return;
      }
      const { canceled, filePath } = await dialog.showSaveDialog(deps.mainWindow, {
        defaultPath: 'yosemite-crew.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return;
      try {
        const wc = deps.activeContents();
        if (!wc) throw new Error('no-active-content');
        const data = await wc.printToPDF({});
        fs.writeFileSync(filePath, data);
        infoDialog('Saved as PDF', `Saved ${Math.round(data.length / 1024)} KB to:\n${filePath}`);
      } catch (error) {
        infoDialog('Save as PDF failed', String(error));
      }
    },

    openOnSecondScreen: (): void => {
      if (!deps.secondaryDisplays) {
        infoDialog('Second Screen', 'Display manager not ready.');
        return;
      }
      if (deps.screen.getAllDisplays().length < 2) {
        infoDialog('Second Screen', 'No secondary display detected.');
        return;
      }
      const wc = deps.activeContents();
      const url = wc?.getURL() || deps.config.startUrl.href;
      deps.secondaryDisplays.openDisplay({
        role: 'presentation',
        url,
        mode: 'extend',
        displayIndex: 1,
      });
    },

    showPrintStatus: (): void => {
      deps.refreshPrinters();
      const status = deps.labelPrintService?.getStatus();
      infoDialog(
        'Printing & Labels',
        `Pending print jobs: ${deps.printService?.getPendingJobs().length ?? 0}\n` +
          `Label printer: ${status?.printerAvailable ? status.printerName || 'available' : 'not detected'}\n` +
          `Supported label types: ${deps.labelPrintService?.getSupportedLabelTypes().join(', ') || 'none'}`
      );
    },

    exportDiagnostics: async (window: BrowserWindow | null): Promise<void> => {
      if (!window || window.isDestroyed()) return;

      const result = await dialog.showSaveDialog(window, {
        defaultPath: `yc-desktop-diagnostics-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });

      if (result.canceled || !result.filePath) return;

      try {
        const data = collectDiagnosticData({
          appVersion: deps.app.getVersion(),
          isPackaged: deps.app.isPackaged,
          platform: process.platform,
          arch: process.arch,
          osRelease: os.release(),
          electronVersion: process.versions.electron || '',
          chromeVersion: process.versions.chrome || '',
          nodeVersion: process.versions.node || '',
          v8Version: process.versions.v8,
          config: deps.config,
          fuses: {
            RunAsNode: false,
            EnableCookieEncryption: true,
            EnableNodeOptionsEnvironmentVariable: false,
            EnableNodeCliInspectArguments: false,
            EnableEmbeddedAsarIntegrityValidation: true,
            OnlyLoadAppFromAsar: true,
            LoadBrowserProcessSpecificV8Snapshot: false,
            GrantFileProtocolExtraPrivileges: true,
          },
        });
        const logPath = path.join(deps.app.getPath('logs'), 'desktop.log');
        const logEntries = readRecentLogEntries(logPath);
        const bundle = createDiagnosticBundle(data, logEntries);
        await writeDiagnosticZip(result.filePath, bundle.diagnosticsJson, bundle.logContent);
        deps.logger.info('diagnostics_exported', { path: result.filePath });
        await dialog.showMessageBox(window, {
          type: 'info',
          buttons: ['OK'],
          message: 'Diagnostics exported successfully.',
          detail: `Saved to:\n${result.filePath}`,
        });
      } catch (error) {
        deps.logger.error('diagnostics_export_failed', { error });
        dialog.showErrorBox('Export Failed', 'Could not create diagnostics bundle.');
      }
    },
  };
};
