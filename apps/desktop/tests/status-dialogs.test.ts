jest.mock('../src/compliance/dea-report', () => ({
  generateDeaReport: jest.fn(() => ({ ok: true })),
  formatDeaReport: jest.fn(() => 'REPORT'),
}));
jest.mock('../src/utils/diagnostics', () => ({
  collectDiagnosticData: jest.fn(() => ({})),
  createDiagnosticBundle: jest.fn(() => ({
    diagnosticsJson: '{}',
    logContent: '',
  })),
  readRecentLogEntries: jest.fn(() => []),
  writeDiagnosticZip: jest.fn(() => Promise.resolve()),
}));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStatusDialogService, type StatusDialogDeps } from '../src/ui/status-dialogs';
import { getDesktopConfig } from '../src/core/navigation-policy';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-sd-'));
const logger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseDialog = () => ({
  showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  showErrorBox: jest.fn(),
  showMessageBoxSync: jest.fn(() => 0),
  showSaveDialogSync: jest.fn(() => path.join(tmp, 'report.json')),
  showSaveDialog: jest.fn(() =>
    Promise.resolve({ canceled: false, filePath: path.join(tmp, 'out.pdf') })
  ),
});

const makeDeps = (overrides: Partial<StatusDialogDeps> = {}): StatusDialogDeps => ({
  logger: logger() as never,
  dialog: baseDialog() as never,
  safeStorage: { isEncryptionAvailable: () => true } as never,
  screen: { getAllDisplays: () => [{}, {}] } as never,
  app: {
    getPath: () => tmp,
    getVersion: () => '1.0.0',
    isPackaged: false,
  } as never,
  config: getDesktopConfig({}),
  auditLog: {
    verifyAll: () => ({ valid: 3, tampered: 0 }),
    verifyChain: () => true,
    size: () => 3,
  } as never,
  csExport: {
    exportDailyLog: () => ({ rowCount: 2, filePath: '/tmp/cs.csv' }),
  } as never,
  deaReminder: { getReminderMessage: () => 'Report due soon' } as never,
  deaTracker: {
    getExpiringSoon: () => [],
    getAllRegistrations: () => [{ deaNumber: 'AB123' }],
  } as never,
  controlledSubstanceLog: {} as never,
  pmpService: {
    getPending: () => [],
    getSubmitted: () => [1],
    getFailed: () => [],
  } as never,
  dualWitnessLog: { getWasteEvents: () => [] } as never,
  offlineAuditTrail: { getUnsyncedCount: () => 0 } as never,
  documentVault: {
    getStats: () => ({ count: 4, totalSizeBytes: 4096 }),
  } as never,
  backupService: { listBackups: () => [{ fileCount: 5, size: 2048 }] } as never,
  runBackup: jest.fn(() => Promise.resolve()),
  mainWindow: { isDestroyed: () => false } as never,
  secondaryDisplays: { openDisplay: jest.fn() } as never,
  labelPrintService: {
    getStatus: () => ({ printerAvailable: true, printerName: 'DYMO' }),
    getSupportedLabelTypes: () => ['address'],
  } as never,
  printService: { getPendingJobs: () => [] } as never,
  activeContents: () =>
    ({
      getURL: () => 'https://yosemitecrew.com/p',
      printToPDF: () => Promise.resolve(Buffer.from('pdf')),
    }) as never,
  refreshPrinters: jest.fn(),
  ...overrides,
});

describe('status dialogs — happy paths', () => {
  test('all info dialogs run with services present', async () => {
    const deps = makeDeps();
    const svc = createStatusDialogService(deps);
    svc.verifyAuditTrail();
    svc.exportCsDailyLog();
    svc.showDeaStatus();
    svc.showPmpStatus();
    svc.showVaultInfo();
    svc.openOnSecondScreen();
    svc.showPrintStatus();
    await svc.backUpNow();
    await svc.savePageAsPdf();
    expect((deps.dialog.showMessageBox as jest.Mock).mock.calls.length).toBeGreaterThan(5);
    expect(deps.secondaryDisplays!.openDisplay).toHaveBeenCalled();
    expect(deps.runBackup).toHaveBeenCalled();
  });

  test('generateDeaReportAction writes the chosen format', () => {
    const deps = makeDeps();
    createStatusDialogService(deps).generateDeaReportAction();
    expect(fs.existsSync(path.join(tmp, 'report.json'))).toBe(true);
    expect(deps.logger.info).toHaveBeenCalledWith('dea_report_saved', expect.any(Object));
  });

  test('exportDiagnostics writes a bundle and confirms', async () => {
    const deps = makeDeps();
    await createStatusDialogService(deps).exportDiagnostics(deps.mainWindow);
    expect(deps.logger.info).toHaveBeenCalledWith('diagnostics_exported', expect.any(Object));
  });
});

describe('status dialogs — uninitialized / edge branches', () => {
  test('falls back to friendly messages when services are missing', async () => {
    const deps = makeDeps({
      auditLog: null,
      csExport: null,
      documentVault: null,
      backupService: null,
      secondaryDisplays: null,
      controlledSubstanceLog: null,
    });
    const svc = createStatusDialogService(deps);
    svc.verifyAuditTrail();
    svc.exportCsDailyLog();
    svc.showVaultInfo();
    svc.generateDeaReportAction();
    svc.openOnSecondScreen();
    await svc.backUpNow();
    expect(deps.dialog.showErrorBox).toHaveBeenCalledWith('DEA Report', expect.any(String));
  });

  test('exportCsDailyLog reports when there is nothing to export', () => {
    const deps = makeDeps({
      csExport: { exportDailyLog: () => null } as never,
    });
    createStatusDialogService(deps).exportCsDailyLog();
    expect(deps.dialog.showMessageBox).toHaveBeenCalled();
  });

  test('generateDeaReportAction aborts when the format picker is cancelled', () => {
    const dialog = baseDialog();
    dialog.showSaveDialogSync = jest.fn(() => undefined as never);
    const deps = makeDeps({ dialog: dialog as never });
    createStatusDialogService(deps).generateDeaReportAction();
    expect(deps.logger.info).not.toHaveBeenCalledWith('dea_report_saved', expect.any(Object));
  });

  test('generateDeaReportAction warns and aborts when no DEA registration exists', () => {
    const dialog = baseDialog();
    dialog.showMessageBoxSync = jest.fn(() => 0); // warning → "Cancel"
    const deps = makeDeps({
      dialog: dialog as never,
      deaTracker: { getExpiringSoon: () => [], getAllRegistrations: () => [] } as never,
    });
    createStatusDialogService(deps).generateDeaReportAction();
    expect(deps.logger.info).not.toHaveBeenCalledWith('dea_report_saved', expect.any(Object));
  });

  test('generateDeaReportAction generates an empty template when confirmed', () => {
    let call = 0;
    const dialog = baseDialog();
    // 1st prompt = warning → "Generate anyway" (1); 2nd = format picker → JSON (0)
    dialog.showMessageBoxSync = jest.fn(() => (call++ === 0 ? 1 : 0));
    const deps = makeDeps({
      dialog: dialog as never,
      deaTracker: { getExpiringSoon: () => [], getAllRegistrations: () => [] } as never,
    });
    createStatusDialogService(deps).generateDeaReportAction();
    expect(deps.logger.info).toHaveBeenCalledWith('dea_report_saved', expect.any(Object));
  });

  test('showDeaStatus reports when no DEA registration is configured', () => {
    const deps = makeDeps({
      deaTracker: { getExpiringSoon: () => [], getAllRegistrations: () => [] } as never,
    });
    createStatusDialogService(deps).showDeaStatus();
    expect(deps.dialog.showMessageBox).toHaveBeenCalled();
  });

  test('generateDeaReportAction aborts when the format picker Cancel is chosen', () => {
    const dialog = baseDialog();
    // Index past the three formats = the appended "Cancel" button.
    dialog.showMessageBoxSync = jest.fn(() => 3);
    const deps = makeDeps({ dialog: dialog as never }); // default deaTracker has a registration
    createStatusDialogService(deps).generateDeaReportAction();
    expect(deps.logger.info).not.toHaveBeenCalledWith('dea_report_saved', expect.any(Object));
  });

  test('savePageAsPdf no-ops without a window and handles cancel', async () => {
    const noWin = makeDeps({ mainWindow: null });
    await createStatusDialogService(noWin).savePageAsPdf();

    const dialog = baseDialog();
    dialog.showSaveDialog = jest.fn(() => Promise.resolve({ canceled: true, filePath: '' }));
    const cancelled = makeDeps({ dialog: dialog as never });
    await createStatusDialogService(cancelled).savePageAsPdf();
    expect(noWin.dialog.showMessageBox).toHaveBeenCalled();
  });

  test('openOnSecondScreen reports when only one display', () => {
    const deps = makeDeps({ screen: { getAllDisplays: () => [{}] } as never });
    createStatusDialogService(deps).openOnSecondScreen();
    expect(deps.secondaryDisplays!.openDisplay).not.toHaveBeenCalled();
  });

  test('optional services degrade to zero/fallback values', async () => {
    const deps = makeDeps({
      deaReminder: null,
      deaTracker: null,
      pmpService: null,
      dualWitnessLog: null,
      offlineAuditTrail: null,
      labelPrintService: null,
      printService: null,
      activeContents: () => null,
    });
    const svc = createStatusDialogService(deps);
    svc.showDeaStatus();
    svc.showPmpStatus();
    svc.showPrintStatus();
    svc.openOnSecondScreen(); // two displays present, but no active contents → startUrl fallback
    expect(deps.secondaryDisplays!.openDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ url: deps.config.startUrl.href })
    );
    await svc.savePageAsPdf(); // active contents null → error path
    expect(deps.refreshPrinters).toHaveBeenCalled();
  });

  test('exportDiagnostics no-ops for a destroyed window and on cancel', async () => {
    await createStatusDialogService(makeDeps()).exportDiagnostics(null);
    const dialog = baseDialog();
    dialog.showSaveDialog = jest.fn(() => Promise.resolve({ canceled: true, filePath: '' }));
    const deps = makeDeps({ dialog: dialog as never });
    await createStatusDialogService(deps).exportDiagnostics(deps.mainWindow);
    expect(deps.logger.info).not.toHaveBeenCalledWith('diagnostics_exported', expect.any(Object));
  });
});
