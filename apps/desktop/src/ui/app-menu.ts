'use strict';

import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import { t as translateMessage, type MessageKey } from '../utils/i18n';
import { openExternal } from '../shell/window-config';

export interface MenuActions {
  checkForUpdates: () => void;
  openCommandPalette: () => void;
  createSettingsWindow: () => void;
  newTab: () => void;
  closeActiveTab: () => void;
  reopenClosedTab: () => void;
  openTabSearch: () => void;
  loadStartUrl: () => void;
  activeContents: () => Electron.WebContents | null;
  setTabOrientation: (mode: 'horizontal' | 'vertical') => void;
  // Live getters: the menu is built once but tab state mutates afterwards, so
  // these are read at click/build time rather than captured as snapshots.
  tabOrientation: () => 'horizontal' | 'vertical';
  splitId: () => string | null;
  setSplitTab: (id: string | null) => void;
  tabMode: () => boolean;
  attachedTabId: () => string | null;
  tabManager: { getState: () => { tabs: Array<{ id: string }> } } | null;
  verifyAuditTrail: () => void;
  exportCsDailyLog: () => void;
  showDeaStatus: () => void;
  generateDeaReportAction: () => void;
  showPmpStatus: () => void;
  openVaultWindow: () => void;
  showVaultInfo: () => void;
  backUpNow: () => void;
  savePageAsPdf: () => void;
  openOnSecondScreen: () => void;
  showPrintStatus: () => void;
  startTelehealth: (intent?: Record<string, unknown>) => string;
  telehealthProviderName: string;
  exportDiagnostics: (window: Electron.BrowserWindow | null) => void;
  mainWindow: Electron.BrowserWindow | null;
  helpLinks: ReadonlyArray<{ label: string; url: string }>;
  productName: string;
  startUrl: string;
  logger: {
    debug: (e: string, d?: unknown) => void;
    info: (e: string, d?: unknown) => void;
    warn: (e: string, d?: unknown) => void;
    error: (e: string, d?: unknown) => void;
  };
}

const tr = (key: MessageKey): string => translateMessage(key, app.getLocale());

export const createAppMenu = (actions: MenuActions): void => {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              {
                label: tr('menu.checkForUpdates'),
                click: () => actions.checkForUpdates(),
              },
              { type: 'separator' as const },
              {
                label: 'Command Palette…',
                accelerator: 'Cmd+Shift+P',
                click: actions.openCommandPalette,
              },
              {
                label: 'Preferences…',
                accelerator: 'Cmd+,',
                click: actions.createSettingsWindow,
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { label: tr('menu.quit'), click: () => app.quit() },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => actions.newTab(),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: actions.closeActiveTab,
        },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: actions.reopenClosedTab,
        },
        {
          label: 'Search Tabs…',
          accelerator: 'CmdOrCtrl+Shift+Y',
          click: actions.openTabSearch,
        },
        { type: 'separator' as const },
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: actions.loadStartUrl,
        },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => actions.activeContents()?.print({}),
        },
        {
          label: 'Open in Browser',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            const wc = actions.activeContents();
            const currentUrl = wc?.getURL() || actions.startUrl;
            void openExternal(currentUrl);
          },
        },
        { type: 'separator' as const },
        ...(isMac
          ? []
          : [
              {
                label: 'Command Palette…',
                accelerator: 'Ctrl+Shift+P',
                click: actions.openCommandPalette,
              } as MenuItemConstructorOptions,
              { type: 'separator' as const },
            ]),
        ...(isMac
          ? []
          : [
              {
                label: 'Preferences…',
                accelerator: 'Ctrl+,',
                click: actions.createSettingsWindow,
              } as MenuItemConstructorOptions,
            ]),
        { type: 'separator' as const },
        {
          role: 'close',
          label: 'Close Window',
          accelerator: 'Shift+CmdOrCtrl+W',
        },
        ...(isMac ? [] : [{ role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' as const },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' as const },
        {
          label: 'Find…',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const wc = actions.activeContents();
            if (wc && !wc.isDestroyed()) {
              wc.send('yc:shortcut', 'find-in-page');
            }
          },
        },
        {
          label: 'Find Next',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            const wc = actions.activeContents();
            if (wc && !wc.isDestroyed()) {
              wc.send('yc:shortcut', 'find-next');
            }
          },
        },
        {
          label: 'Find Previous',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            const wc = actions.activeContents();
            if (wc && !wc.isDestroyed()) {
              wc.send('yc:shortcut', 'find-previous');
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            const wc = actions.activeContents();
            if (wc && !wc.isDestroyed()) wc.toggleDevTools();
          },
        },
        { type: 'separator' as const },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' as const },
        {
          label: 'Toggle Vertical Tabs',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () =>
            actions.setTabOrientation(
              actions.tabOrientation() === 'vertical' ? 'horizontal' : 'vertical'
            ),
        },
        {
          label: actions.splitId() ? 'Close Split View' : 'Split View',
          accelerator: 'CmdOrCtrl+Shift+\\',
          click: () => {
            if (actions.splitId()) {
              actions.setSplitTab(null);
            } else if (actions.tabMode() && actions.attachedTabId() && actions.tabManager) {
              const state = actions.tabManager.getState();
              const attached = actions.attachedTabId();
              const other = state.tabs.find((t) => t.id !== attached);
              if (other) actions.setSplitTab(other.id);
            }
          },
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => actions.activeContents()?.navigationHistory.goBack(),
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => actions.activeContents()?.navigationHistory.goForward(),
        },
      ],
    },
    {
      label: 'Compliance',
      submenu: [
        {
          label: 'Verify Audit Trail Integrity',
          click: actions.verifyAuditTrail,
        },
        {
          label: 'Export Controlled-Substance Daily Log',
          click: actions.exportCsDailyLog,
        },
        { type: 'separator' as const },
        { label: 'DEA Renewal Status', click: actions.showDeaStatus },
        {
          label: 'Generate DEA Biennial Report…',
          click: actions.generateDeaReportAction,
        },
        { label: 'PMP Submission Status', click: actions.showPmpStatus },
      ],
    },
    {
      label: 'Data',
      submenu: [
        { label: 'Document Vault Browser…', click: actions.openVaultWindow },
        { label: 'Document Vault Info', click: actions.showVaultInfo },
        { type: 'separator' as const },
        { label: 'Back Up Data Now', click: actions.backUpNow },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Save Page as PDF...', click: () => actions.savePageAsPdf() },
        { label: 'Open on Second Screen', click: actions.openOnSecondScreen },
        { label: 'Printing & Label Status', click: actions.showPrintStatus },
        { type: 'separator' as const },
        {
          label: actions.telehealthProviderName,
          click: () => {
            actions.startTelehealth();
          },
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: tr('menu.checkForUpdates'),
          click: () => actions.checkForUpdates(),
        },
        { type: 'separator' as const },
        {
          label: 'Export Diagnostics...',
          click: () => actions.exportDiagnostics(actions.mainWindow),
        },
        { type: 'separator' as const },
        ...actions.helpLinks.map((link) => ({
          label: link.label,
          click: () => void openExternal(link.url),
        })),
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'about' as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
