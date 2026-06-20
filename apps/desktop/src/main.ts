'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  Menu,
  powerMonitor,
  nativeTheme,
  dialog,
  shell,
  crashReporter,
  Notification,
  net,
  globalShortcut,
  safeStorage,
  screen,
  WebContentsView,
  systemPreferences,
  type Tray,
  type Session,
  type WebContents,
} from 'electron';
import { classifyNavigation, deepLinkToUrl, getDesktopConfig } from './core/navigation-policy';
import { createCrashReporter, wireCrashLogging } from './lifecycle/crash-reporting';
import { registerIpc as registerIpcHandlers } from './core/ipc-handlers';
import type { createTabManager } from './core/tab-manager';
import type { createTabViewHost } from './ui/tab-view-host';
import { createLogger, type DesktopLogger } from './utils/logger';
import { createWindowStateStore, type WindowStateStore } from './core/window-state';
import { checkForUpdatesManually } from './lifecycle/updater';
import { createReloadGuard } from './core/reload-guard';
import { aboutPanelOptions } from './ui/branding';
import { reduceAuth, type AuthState } from './utils/auth-state';
import {
  createKeyboardShortcutManager,
  type KeyboardShortcutManager,
} from './ui/keyboard-shortcuts';
import { idleLockMinutesFromEnv, shouldLockAfterIdle } from './lifecycle/idle-lock';
import {
  setupTray,
  setupTelemetry,
  setupCompliance,
  setupVaultAndBackup,
  setupOfflineSync,
  setupNativeSurfaces,
} from './boot/setup';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  type DesktopSettings,
  type SettingsStore,
} from './utils/settings-store';
import { createRecentsStore, BUILTIN_ACTIONS, type RecentsStore } from './ui/command-palette';
import { PAGE_ACTION_TRIGGERS, buildPageActionScript } from './ui/page-actions';
import { createOfflineCache, type OfflineCache } from './sync/offline-cache';
import { createNotificationManager, type NotificationManager } from './ui/notifications';
import { createSyncDaemon, type SyncDaemon } from './sync/sync-daemon';
import { createSyncQueue, type SyncQueue } from './sync/sync-queue';
import { createBiometricLock, type BiometricLock } from './lifecycle/biometric-lock';
import type { ColdStartWatchdog } from './core/cold-start-watchdog';
import { createLocalApiServer, type LocalApiServer } from './core/local-api';
import { applyThemeToWebContents, DEFAULT_ACCENT_COLOR } from './ui/theming';
import {
  readTracker,
  recordCrash,
  resetTracker,
  evaluateRollback,
  ROLLBACK_FILENAME,
  type RollbackTracker,
} from './lifecycle/auto-rollback';
import type { AuditLog } from './compliance/audit-log';
import type { ControlledSubstanceLogbook } from './compliance/controlled-substance';
import type { OfflineAuditTrail } from './compliance/offline-audit-trail';
import type { DeaRegistrationTracker } from './compliance/dea-registration';
import type { DeaBiennialReminder } from './compliance/dea-reminder';
import type { DualWitnessLog } from './compliance/dual-witness';
import type { PmpSubmissionService } from './compliance/pmp-submission';
import type { CsDailyExportService } from './compliance/cs-export';
import type { DocumentVault } from './utils/document-vault';
import type { BackupService } from './utils/backup';
import type { OfflineStore } from './sync/offline-store';
import type { SyncEngine, SyncResult } from './sync/sync-engine';
import { summarizeSyncStatus } from './sync/sync-status';
import type { SecondaryDisplayManager } from './ui/secondary-display';
import type { PrintService, LabelPrintService } from './utils/printing';
import { readManagedConfig, managedConfigToEnv } from './utils/mdm';
import { createStatusDialogService, type StatusDialogService } from './ui/status-dialogs';

import {
  STREAM_TELEHEALTH_PROVIDER,
  buildTelehealthUrl,
  type TelehealthLaunchIntent,
} from './utils/telehealth';
import {
  secureWebPreferences,
  DEEP_LINK_SCHEME,
  deepLinkFromArgv,
  handleWindowOpen,
  handleMainNavigation,
  buildContextMenu,
} from './shell/window-config';
import { createMainWindow } from './shell/create-main-window';

// Apply managed/MDM config first: fill any env var an admin set via managed
// preferences that isn't already explicitly set, so navigation-policy, updater,
// idle-lock and telemetry pick it up. Explicit env (QA) still wins.
try {
  const managedEnv = managedConfigToEnv(readManagedConfig());
  for (const [k, v] of Object.entries(managedEnv)) {
    process.env[k] ??= v;
  }
} catch {
  // managed config is optional; ignore read/parse failures
}

const config = getDesktopConfig();
const PRODUCT_NAME = 'Yosemite Crew PIMS';
const BRAND_PREFIX = 'Yosemite Crew';

app.setName(PRODUCT_NAME);
if (process.env.YC_DESKTOP_USER_DATA_DIR) {
  app.setPath('userData', process.env.YC_DESKTOP_USER_DATA_DIR);
}

let mainWindow: BrowserWindow | null = null;
let windowStateStore: WindowStateStore | null = null;
let downloadsConfigured = false;
let keyboardShortcutManager: KeyboardShortcutManager | null = null;
let pendingDeepLink: string | null = null;
let logger: DesktopLogger = createLogger();
const reloadGuard = createReloadGuard();
let authState: AuthState = 'signed-out';
let signedInBefore = false;
let tray: Tray | null = null;
let settingsStore: SettingsStore | null = null;
let settingsWindow: BrowserWindow | null = null;
let commandPaletteWindow: BrowserWindow | null = null;
let vaultWindow: BrowserWindow | null = null;
let recentsStore: RecentsStore | null = null;
let offlineCache: OfflineCache | null = null;
let notificationManager: NotificationManager | null = null;
let biometricLock: BiometricLock | null = null;
let rollbackTracker: RollbackTracker | null = null;
let coldStartWatchdog: ColdStartWatchdog | null = null;
let localApi: LocalApiServer | null = null;
let syncDaemon: SyncDaemon | null = null;
let syncQueue: SyncQueue | null = null;
let auditLog: AuditLog | null = null;
let controlledSubstanceLog: ControlledSubstanceLogbook | null = null;
let offlineAuditTrail: OfflineAuditTrail | null = null;
let deaTracker: DeaRegistrationTracker | null = null;
let deaReminder: DeaBiennialReminder | null = null;
let dualWitnessLog: DualWitnessLog | null = null;
let pmpService: PmpSubmissionService | null = null;
let csExport: CsDailyExportService | null = null;
let documentVault: DocumentVault | null = null;
let backupService: BackupService | null = null;
let backupTimer: ReturnType<typeof setInterval> | null = null;
let offlineStore: OfflineStore | null = null;
let syncEngine: SyncEngine | null = null;
let offlineSyncTimer: ReturnType<typeof setInterval> | null = null;
let lastOfflineSyncResults: SyncResult[] = [];
let lastOfflineSyncError: string | null = null;
let secondaryDisplays: SecondaryDisplayManager | null = null;
let printService: PrintService | null = null;
let labelPrintService: LabelPrintService | null = null;
let cachedPrinterNames: string[] = [];
let tabManager: ReturnType<typeof createTabManager> | null = null;
let tabViewHost: ReturnType<typeof createTabViewHost> | null = null;
const CHROME_STRIP_HEIGHT = 40;
const VERTICAL_TAB_WIDTH = 240;
let tabOrientation: 'horizontal' | 'vertical' = 'horizontal';
let attachedTabId: string | null = null;
let splitId: string | null = null;
let saveSession = (): void => {};

// The app menu captures these references before the real status-dialog service
// is created (it's built after compliance/vault setup to avoid blocking cold
// start). Keep statusDlg a stable facade that delegates to statusImpl once set,
// so the menu's Compliance/Data/Tools actions work on the first window too.
let statusImpl: StatusDialogService | null = null;
const statusDlg: StatusDialogService = {
  verifyAuditTrail: () => statusImpl?.verifyAuditTrail(),
  exportCsDailyLog: () => statusImpl?.exportCsDailyLog(),
  showDeaStatus: () => statusImpl?.showDeaStatus(),
  generateDeaReportAction: () => statusImpl?.generateDeaReportAction(),
  showPmpStatus: () => statusImpl?.showPmpStatus(),
  showVaultInfo: () => statusImpl?.showVaultInfo(),
  backUpNow: async () => {
    await statusImpl?.backUpNow();
  },
  savePageAsPdf: async () => {
    await statusImpl?.savePageAsPdf();
  },
  openOnSecondScreen: () => statusImpl?.openOnSecondScreen(),
  showPrintStatus: () => statusImpl?.showPrintStatus(),
  exportDiagnostics: async (window) => {
    await statusImpl?.exportDiagnostics(window);
  },
};

const authHintPath = (): string => path.join(app.getPath('userData'), 'auth-hint.json');

const loadSignedInHint = (): boolean => {
  try {
    return JSON.parse(fs.readFileSync(authHintPath(), 'utf8')).signedIn === true;
  } catch {
    return false;
  }
};

// Persist the last known auth state both ways: true on sign-in, false on logout,
// so the welcome screen reappears whenever the user is signed out.
const persistAuthHint = (signedIn: boolean): void => {
  if (signedInBefore === signedIn) return;
  signedInBefore = signedIn;
  try {
    fs.mkdirSync(path.dirname(authHintPath()), { recursive: true });
    fs.writeFileSync(authHintPath(), JSON.stringify({ signedIn }), 'utf8');
  } catch (error) {
    logger.warn('auth_hint_save_failed', { error });
  }
};

const notifySignedIn = (): void => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: PRODUCT_NAME,
        body: 'You are signed in. Welcome back!',
        silent: true,
      }).show();
    }
  } catch (error) {
    logger.warn('signed_in_notification_failed', { error });
  }
};

// Infer sign-in/out from in-app navigation: confirm the first successful login,
// and reset to signed-out on logout so the welcome screen returns next launch.
const trackAuthNavigation = (rawUrl: string): void => {
  const previous = authState;
  const result = reduceAuth(previous, rawUrl);
  authState = result.state;
  if (result.justSignedIn) {
    logger.info('signed_in', { url: rawUrl });
    persistAuthHint(true);
    notifySignedIn();
  } else if (previous === 'signed-in' && result.state === 'signed-out') {
    logger.info('signed_out', { url: rawUrl });
    persistAuthHint(false);
  }
};

const getIconPath = () => path.join(__dirname, '..', 'resources', 'icon.png');
type DesktopPage =
  | 'loading'
  | 'offline'
  | 'welcome'
  | 'settings'
  | 'command-palette'
  | 'tabbar'
  | 'whats-new'
  | 'vault';
// Local pages are loaded via file:// (loadFile), which renders reliably in
// packaged builds; a custom protocol proved flaky behind the security fuses.
const localPage = (page: DesktopPage): string => path.join(__dirname, 'pages', `${page}.html`);

// In tab mode, navigation/content targets the active tab's WebContents; before
// tab mode (welcome/loading) it targets the base window contents.
let tabChromeView: WebContentsView | null = null;
let tabMode = false;
let tabSearchOpen = false;

const activeContents = (): WebContents | null => {
  if (tabMode && attachedTabId && tabViewHost) {
    const v = tabViewHost.get(attachedTabId);
    if (v) return v.webContents;
  }
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
};

type TabBounds = { width: number; height: number };

const tabContentPaneWidth = (
  pane: 'full' | 'left' | 'right',
  full: number,
  half: number
): number => {
  if (pane === 'full') return full;
  if (pane === 'left') return half;
  return full - half;
};

const setTabViewBounds = (
  tvh: NonNullable<typeof tabViewHost>,
  id: string,
  pane: 'full' | 'left' | 'right',
  b: TabBounds,
  isVertical: boolean
): void => {
  if (isVertical) {
    const cw = Math.max(0, b.width - VERTICAL_TAB_WIDTH);
    const half = Math.floor(cw / 2);
    tvh.setBounds(id, {
      x: VERTICAL_TAB_WIDTH + (pane === 'right' ? half : 0),
      y: 0,
      width: tabContentPaneWidth(pane, cw, half),
      height: b.height,
    });
    return;
  }
  const ch = Math.max(0, b.height - CHROME_STRIP_HEIGHT);
  const half = Math.floor(b.width / 2);
  tvh.setBounds(id, {
    x: pane === 'right' ? half : 0,
    y: CHROME_STRIP_HEIGHT,
    width: tabContentPaneWidth(pane, b.width, half),
    height: ch,
  });
};

const layoutChromeStrip = (b: TabBounds, isVertical: boolean): void => {
  if (!tabChromeView) return;
  if (isVertical) {
    tabChromeView.setBounds({
      x: 0,
      y: 0,
      width: VERTICAL_TAB_WIDTH,
      height: b.height,
    });
    return;
  }
  tabChromeView.setBounds({
    x: 0,
    y: 0,
    width: b.width,
    height: tabSearchOpen ? b.height : CHROME_STRIP_HEIGHT,
  });
};

const layoutContentPanes = (b: TabBounds, isVertical: boolean): void => {
  const tvh = tabViewHost;
  if (!attachedTabId || !tvh || !mainWindow) return;
  const hasSplit = Boolean(splitId && tvh.get(splitId) && splitId !== attachedTabId);
  // In split view the primary tab takes the LEFT half (not the full width) so
  // the two views sit side by side instead of the split overlaying the primary.
  setTabViewBounds(tvh, attachedTabId, hasSplit ? 'left' : 'full', b, isVertical);
  if (!hasSplit) return;
  setTabViewBounds(tvh, splitId!, 'right', b, isVertical);
  const av = tvh.get(attachedTabId);
  const sv = tvh.get(splitId!);
  if (av) mainWindow.contentView.addChildView(av);
  if (sv) mainWindow.contentView.addChildView(sv);
};

// Always keep the tab-bar chrome view topmost in z-order. Input is routed to
// the topmost sibling WebContentsView, so any content view added above (on
// attach, split, or detach) steals the clicks/hover meant for the tab bar
// controls. A bare addChildView on an already-attached view does not reliably
// re-order it, so remove then re-add to force the 40px chrome strip to the top.
const raiseTabChrome = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (tabChromeView && !tabChromeView.webContents.isDestroyed()) {
    mainWindow.contentView.removeChildView(tabChromeView);
    mainWindow.contentView.addChildView(tabChromeView);
  }
};

const layoutTabChrome = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const b = mainWindow.getContentBounds();
  const isVertical = tabOrientation === 'vertical';
  layoutChromeStrip(b, isVertical);
  layoutContentPanes(b, isVertical);
  raiseTabChrome();
};

// Switch the window into multi-tab mode: mount the tab-bar chrome view and the
// content view(s). Idempotent. Recreates restored tabs or seeds one.
const enterTabMode = (initialUrl: string): void => {
  if (tabMode || !mainWindow || mainWindow.isDestroyed() || !tabManager || !tabViewHost) return;
  tabMode = true;
  tabChromeView = new WebContentsView({
    webPreferences: secureWebPreferences(path.join(__dirname, 'preload.js')),
  });
  void tabChromeView.webContents
    .loadFile(localPage('tabbar'))
    .then(() => {
      const cv = tabChromeView;
      if (!cv || cv.webContents.isDestroyed()) return;
      // Seed the tab bar with the saved theme. A WebContentsView doesn't reliably
      // track nativeTheme/prefers-color-scheme live, so set the explicit
      // data-theme attribute tokens.css reads.
      applyThemeModeToWc(cv.webContents, (settingsStore?.load() || DEFAULT_SETTINGS).theme);
      if (tabOrientation === 'vertical') {
        void cv.webContents
          .executeJavaScript(
            `document.getElementById('tabbar')?.setAttribute('data-orientation','vertical')`
          )
          .catch((error) => logger.warn('tabbar_orientation_js_failed', { error }));
      }
    })
    .catch((error) => logger.warn('tabbar_load_failed', { error }));
  mainWindow.contentView.addChildView(tabChromeView);

  let tabs = tabManager.getState().tabs;
  if (tabs.length === 0) {
    tabManager.create(initialUrl);
    tabs = tabManager.getState().tabs;
  }
  for (const t of tabs) tabViewHost.create(t.id, t.url);
  const activeId = tabManager.getState().activeId || tabs[0]?.id || null;
  if (activeId) {
    const view = tabViewHost.get(activeId);
    if (view) mainWindow.contentView.addChildView(view);
    attachedTabId = activeId;
  }
  layoutTabChrome();
  logger.info('tab_mode_entered', { tabs: tabs.length });
  saveSession();
};

// A WebContentsView added to a not-yet-shown window does not paint until it is
// re-laid-out, so a restored/active tab would otherwise sit transparent over the
// loading splash forever. Re-attach + re-layout the active tab once the window is
// actually visible. Needed on cold start (restored session) AND on macOS dock
// reopen — both create the window hidden, then show it asynchronously.
const repaintActiveTabOnShow = (): void => {
  if (!mainWindow || mainWindow.isVisible()) return;
  mainWindow.once('show', () => {
    if (attachedTabId && tabViewHost && mainWindow && !mainWindow.isDestroyed()) {
      const activeView = tabViewHost.get(attachedTabId);
      if (activeView) {
        mainWindow.contentView.removeChildView(activeView);
        mainWindow.contentView.addChildView(activeView);
      }
    }
    layoutTabChrome();
  });
};

// Make `id` the active tab: swap the content view and re-layout.
const detachContentView = (id: string): void => {
  if (!tabViewHost || !mainWindow || mainWindow.isDestroyed()) return;
  const old = tabViewHost.get(id);
  if (old) mainWindow.contentView.removeChildView(old);
};

const switchToTab = (id: string): void => {
  const win = mainWindow;
  if (!tabViewHost || !win || win.isDestroyed()) return;
  // Detach the outgoing primary view, but keep an active split view mounted
  // when switching to a different (non-split) tab so it stays side by side.
  const keepSplit = Boolean(splitId && splitId !== id);
  if (attachedTabId && attachedTabId !== id && !(keepSplit && attachedTabId === splitId)) {
    detachContentView(attachedTabId);
  }
  const view = tabViewHost.get(id);
  if (view) win.contentView.addChildView(view);
  attachedTabId = id;
  tabManager?.activate(id);
  layoutTabChrome();
};

// Menu/shortcut tab actions (the tab-bar UI uses the IPC handlers; these share
// the same module state).
const newTab = (url?: string): void => {
  if (!tabMode) {
    enterTabMode(url || config.startUrl.href);
    return;
  }
  if (!tabManager || !tabViewHost) return;
  // For a signed-in user, defaulting a new tab to the start URL (/signin) lands
  // on the login page, which the web app 404s/bounces. Open the active tab's
  // current in-app page instead; fall back to the start URL only when the active
  // page isn't a normal in-app URL (e.g. the offline page or a data: URL).
  const activeUrl = attachedTabId ? tabViewHost.getUrl(attachedTabId) : '';
  const activeIsInApp =
    !!activeUrl && classifyNavigation(activeUrl, config).disposition === 'internal';
  const target = url || (activeIsInApp ? activeUrl : config.startUrl.href);
  const id = tabManager.create(target);
  tabViewHost.create(id, target);
  switchToTab(id);
  saveSession();
};

// Closing the last remaining tab leaves tab mode entirely and returns to the
// welcome (sign-in) screen, instead of stranding the user on the hidden loading
// page beneath an empty tab bar.
const exitTabMode = (): void => {
  if (tabChromeView) {
    if (mainWindow && !mainWindow.isDestroyed() && !tabChromeView.webContents.isDestroyed()) {
      mainWindow.contentView.removeChildView(tabChromeView);
    }
    if (!tabChromeView.webContents.isDestroyed()) tabChromeView.webContents.close();
    tabChromeView = null;
  }
  tabViewHost?.destroyAll();
  tabMode = false;
  attachedTabId = null;
  splitId = null;
  saveSession();
  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.webContents
      .loadFile(localPage('welcome'))
      .catch((error) => logger.warn('welcome_reload_failed', { error }));
  }
};

const closeActiveTab = (): void => {
  if (!tabMode || !tabManager || !tabViewHost || !attachedTabId) return;
  const id = attachedTabId;
  // If closing the split tab, clear split first
  if (splitId === id) splitId = null;
  // If split is active, the split tab becomes primary instead
  if (splitId && splitId !== id) {
    attachedTabId = null;
    tabManager.close(id);
    const old = tabViewHost.get(id);
    if (old && mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(old);
    tabViewHost.destroy(id);
    switchToTab(splitId);
    splitId = null;
    saveSession();
    return;
  }
  const old = tabViewHost.get(id);
  if (old && mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(old);
  tabViewHost.destroy(id);
  attachedTabId = null;
  tabManager.close(id);
  const next = tabManager.getState().activeId;
  if (next) {
    switchToTab(next);
    saveSession();
    return;
  }
  exitTabMode();
};

const reopenClosedTab = (): void => {
  if (!tabMode || !tabManager || !tabViewHost) return;
  const id = tabManager.reopenClosed();
  if (!id) return;
  const tab = tabManager.getState().tabs.find((t) => t.id === id);
  if (tab) {
    tabViewHost.create(id, tab.url);
    switchToTab(id);
  }
  saveSession();
};

// Expand/collapse the chrome view for the search overlay and keep it on top.
const setSplitTab = (id: string | null): void => {
  splitId = id;
  if (tabChromeView && !tabChromeView.webContents.isDestroyed()) {
    void tabChromeView.webContents
      .executeJavaScript(`window.__ycSplitId = ${JSON.stringify(id)}`)
      .catch((error) => logger.warn('split_id_js_failed', { error }));
  }
  layoutTabChrome();
};

const setTabOrientation = (mode: 'horizontal' | 'vertical'): void => {
  tabOrientation = mode;
  if (tabChromeView && !tabChromeView.webContents.isDestroyed()) {
    void tabChromeView.webContents
      .executeJavaScript(
        `document.getElementById('tabbar')?.setAttribute('data-orientation','${mode}')`
      )
      .catch((error) => logger.warn('tabbar_orientation_js_failed', { error }));
  }
  layoutTabChrome();
};

const setTabSearch = (open: boolean): void => {
  tabSearchOpen = open;
  if (open && tabChromeView && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.addChildView(tabChromeView); // raise above content
  }
  layoutTabChrome();
};

// Open the Figma-style tab search panel (from the menu/shortcut).
const openTabSearch = (): void => {
  if (!tabChromeView || tabChromeView.webContents.isDestroyed()) return;
  setTabSearch(true);
  void tabChromeView.webContents
    .executeJavaScript('window.__ycOpenTabSearch && window.__ycOpenTabSearch()')
    .catch((error) => logger.warn('tab_search_js_failed', { error }));
};

const loadStartUrl = (): void => {
  if (tabMode && !activeContents()) return;
  const wc = activeContents();
  if (wc) {
    logger.info('navigation_home', { href: config.startUrl.href });
    void wc.loadURL(config.startUrl.href);
  }
};

const showOfflinePage = (reason: string): void => {
  const wc = activeContents();
  if (!wc) return;
  logger.warn('offline_page_shown', { reason });
  void wc.loadFile(localPage('offline'), { query: { reason: reason || '' } });
};

const focusMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
};

const handleDeepLink = (rawUrl: string): void => {
  const href = deepLinkToUrl(rawUrl, config);
  if (!href) {
    logger.warn('deep_link_rejected', { rawUrl });
    return;
  }

  logger.info('deep_link_opened', { href });
  const wc = activeContents();
  if (wc) {
    void wc.loadURL(href);
    focusMainWindow();
  } else {
    pendingDeepLink = href;
  }
};

const consumePendingDeepLink = (): void => {
  if (!pendingDeepLink || !mainWindow || mainWindow.isDestroyed()) return;
  const href = pendingDeepLink;
  pendingDeepLink = null;
  void activeContents()?.loadURL(href);
};

const configureDownloads = (ses: Session): void => {
  if (downloadsConfigured) return;
  downloadsConfigured = true;

  ses.on('will-download', (_event, item) => {
    logger.info('download_started', {
      filename: item.getFilename(),
      url: item.getURL(),
    });
    item.once('done', (_doneEvent, state) => {
      logger.info('download_finished', { filename: item.getFilename(), state });
      if (state === 'completed') {
        shell.showItemInFolder(item.getSavePath());
        // Auto-save completed downloads into the document vault. Skip very large
        // files — vaulting reads the whole file into memory, which would spike or
        // exhaust main-process memory on a multi-GB download.
        const MAX_VAULT_BYTES = 25 * 1024 * 1024;
        if (documentVault && item.getReceivedBytes() > MAX_VAULT_BYTES) {
          logger.warn('download_vault_skipped_too_large', {
            filename: item.getFilename(),
            bytes: item.getReceivedBytes(),
          });
        } else if (documentVault) {
          try {
            const mimeType = item.getMimeType() || 'application/octet-stream';
            const isText = /^text\/|^application\/(json|xml|javascript)$/.test(mimeType);
            if (isText) {
              const content = fs.readFileSync(item.getSavePath(), 'utf8');
              documentVault.saveDocument(item.getFilename(), content, mimeType);
            } else {
              const content = fs.readFileSync(item.getSavePath());
              documentVault.saveDocumentBuffer(item.getFilename(), content, mimeType);
            }
            logger.debug('download_vaulted', { filename: item.getFilename() });
          } catch {
            logger.warn('download_vault_failed', {
              filename: item.getFilename(),
            });
          }
        }
      } else if (state === 'interrupted') {
        dialog.showErrorBox('Download failed', `${item.getFilename()} could not be downloaded.`);
      }
    });
  });
};

let isOnline = true;

const configureOnlineTracking = (): void => {
  const refresh = (): void => {
    try {
      isOnline = net.isOnline();
    } catch {
      isOnline = true;
    }
  };
  refresh();
  // Electron's `app` does not emit online/offline, so poll net.isOnline()
  // (coarse system connectivity) so offline-serve actually engages.
  const timer = setInterval(refresh, 5000);
  if (typeof timer.unref === 'function') timer.unref();
  (app as unknown as { on: (e: string, cb: () => void) => void }).on('online', () => {
    isOnline = true;
  });
  (app as unknown as { on: (e: string, cb: () => void) => void }).on('offline', () => {
    isOnline = false;
  });
};

const configureOfflineServe = (ses: Session): void => {
  const ALLOWED_ORIGINS: string[] = [];
  const rawOrigins = process.env.YC_DESKTOP_ALLOWED_ORIGINS || config.startUrl.origin;
  // The env var may hold a comma-separated list (managedConfigToEnv joins
  // allowedOrigins with ','), so parse each entry individually rather than
  // treating the whole string as one URL.
  for (const candidate of rawOrigins.split(',')) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      ALLOWED_ORIGINS.push(new URL(trimmed).origin);
    } catch {
      // skip an unparseable entry; fall back handled below
    }
  }
  if (ALLOWED_ORIGINS.length === 0) {
    ALLOWED_ORIGINS.push(config.startUrl.origin);
  }

  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    if (!isOnline && offlineCache) {
      const originOk = ALLOWED_ORIGINS.some((o) => details.url.startsWith(o));
      if (originOk) {
        const cached = offlineCache.get(details.url);
        if (cached && cached.contentType.startsWith('text/html') && cached.body.length > 0) {
          callback({
            redirectURL: `data:text/html;charset=utf-8,${encodeURIComponent(cached.body.toString('utf8'))}`,
          });
          return;
        }
      }
    }
    callback({ cancel: false });
  });
};

// setupCompliance extracted to src/boot/setup.ts

// setupVaultAndBackup extracted to src/boot/setup.ts

const runBackup = async (): Promise<void> => {
  if (!backupService) return;
  const userData = app.getPath('userData');
  try {
    const result = await backupService.createBackup({
      sourcePaths: [userData],
      destinationDir: path.join(userData, 'backups'),
      maxBackups: 7,
    });
    logger.info('backup_run', {
      success: result.success,
      fileCount: result.fileCount,
      error: result.error,
    });
  } catch (error) {
    logger.warn('backup_failed', { error });
  }
};

// backUpNow, showVaultInfo, savePageAsPdf, openOnSecondScreen, showPrintStatus,
// verifyAuditTrail, exportCsDailyLog, showDeaStatus, generateDeaReportAction,
// showPmpStatus, exportDiagnostics extracted to src/ui/status-dialogs.ts

// setupOfflineSync extracted to src/boot/setup.ts

const runOfflineFullSync = async (): Promise<SyncResult[]> => {
  if (!syncEngine) throw new Error('sync-not-ready');
  const results = await syncEngine.fullSync(['mutations']);
  lastOfflineSyncResults = results;
  const errors = results.flatMap((result) => result.errors);
  lastOfflineSyncError = errors.length > 0 ? errors.join('; ') : null;
  return results;
};

const getDirtyCounts = (): Record<string, number> => {
  if (!offlineStore) return {};
  try {
    return { mutations: offlineStore.getDirtyCount('mutations') };
  } catch (error) {
    logger.warn('sync_dirty_count_failed', { error });
    return {};
  }
};

const getSyncStatusSummary = () =>
  summarizeSyncStatus({
    engineReady: Boolean(syncEngine),
    endpointConfigured: Boolean(process.env.YC_DESKTOP_SYNC_URL),
    daemonStatus:
      syncDaemon?.getStatus() ||
      (syncQueue
        ? {
            running: false,
            online: net.isOnline() ? 'online' : 'offline',
            pendingCount: syncQueue.size(),
          }
        : null),
    dirtyCounts: getDirtyCounts(),
    lastSyncTimestamps: syncEngine?.getLastSyncTimestamps() || {},
    lastError: lastOfflineSyncError,
  });

const clearLocalDesktopData = async (): Promise<{
  cacheCleared: boolean;
  vaultDeleted: number;
  recentsCleared: boolean;
  syncQueueCleared: boolean;
  storageCleared: boolean;
}> => {
  let vaultDeleted = 0;
  if (offlineCache) offlineCache.clear();
  if (documentVault) {
    for (const doc of documentVault.listDocuments()) {
      if (documentVault.deleteDocument(doc.id)) vaultDeleted++;
    }
  }
  recentsStore?.clear();
  syncQueue?.clear();
  lastOfflineSyncResults = [];
  lastOfflineSyncError = null;
  let storageCleared = false;
  try {
    const wc = activeContents();
    await wc?.session.clearStorageData();
    storageCleared = true;
    persistAuthHint(false);
  } catch (error) {
    logger.warn('clear_storage_data_failed', { error });
  }
  return {
    cacheCleared: Boolean(offlineCache),
    vaultDeleted,
    recentsCleared: Boolean(recentsStore),
    syncQueueCleared: Boolean(syncQueue),
    storageCleared,
  };
};

// showVaultInfo extracted to src/ui/status-dialogs.ts

// setupNativeSurfaces extracted to src/boot/setup.ts

// savePageAsPdf, openOnSecondScreen, showPrintStatus extracted to src/ui/status-dialogs.ts

const refreshPrinters = (): void => {
  const wc = activeContents();
  if (!wc) return;
  void wc
    .getPrintersAsync()
    .then((printers) => {
      cachedPrinterNames = printers.map((p) => p.name);
    })
    .catch((error) => logger.warn('printer_enumeration_failed', { error }));
};

// showPrintStatus, verifyAuditTrail, exportCsDailyLog, showDeaStatus,
// generateDeaReportAction, showPmpStatus extracted to src/ui/status-dialogs.ts

// Localized native string (follows the OS locale; catalogs in utils/i18n.ts).
// Telehealth is GetStream-only. PIMS owns call creation and tokens; desktop
// opens the appointment telehealth intent inside the trusted shell.
const startTelehealth = (intent: TelehealthLaunchIntent = {}): string => {
  const href = buildTelehealthUrl(config.startUrl.href, intent);
  const wc = activeContents();
  logger.info('telehealth_started', {
    provider: STREAM_TELEHEALTH_PROVIDER.id,
    hasAppointmentId: Boolean(intent.appointmentId),
    hasCallId: Boolean(intent.callId),
  });

  if (wc) {
    void wc.loadURL(href);
    focusMainWindow();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    newTab(href);
    focusMainWindow();
  } else {
    pendingDeepLink = href;
  }

  return href;
};

// createMainWindow extracted to src/shell/create-main-window.ts

// setupTray and setupTelemetry extracted to src/boot/setup.ts

// Explicitly drive the local (file://) pages' theme via the `data-theme`
// attribute that tokens.css reads, instead of relying solely on
// nativeTheme/prefers-color-scheme. A child WebContentsView (the tab bar) does
// not reliably re-evaluate prefers-color-scheme live when themeSource changes,
// so without this the strip stays on its load-time scheme. 'system' is resolved
// to the current OS appearance and re-applied whenever the OS theme changes.
const resolveThemeMode = (theme: DesktopSettings['theme']): 'dark' | 'light' => {
  if (theme !== 'system') return theme;
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
};

const applyThemeModeToWc = (
  wc: Electron.WebContents | null | undefined,
  theme: DesktopSettings['theme']
): void => {
  if (!wc || wc.isDestroyed()) return;
  const mode = resolveThemeMode(theme);
  wc.executeJavaScript(
    `document.documentElement.setAttribute('data-theme', ${JSON.stringify(mode)})`,
    false
  ).catch(() => {
    /* page may be mid-navigation; theme re-applies on next change */
  });
};

// Re-apply the saved theme to the local-page views. Used on settings change and
// when the OS appearance flips while the user is on 'system'.
const reapplyLocalPageTheme = (): void => {
  const theme = (settingsStore?.load() || DEFAULT_SETTINGS).theme;
  applyThemeModeToWc(tabChromeView?.webContents, theme);
  applyThemeModeToWc(mainWindow?.webContents, theme);
};

// Follow the OS appearance live when the user's preference is 'system'.
nativeTheme.on('updated', reapplyLocalPageTheme);

const applySettings = (settings: DesktopSettings): void => {
  nativeTheme.themeSource = settings.theme === 'system' ? 'system' : settings.theme;
  // Local pages that won't re-evaluate prefers-color-scheme on their own.
  applyThemeModeToWc(tabChromeView?.webContents, settings.theme);
  applyThemeModeToWc(mainWindow?.webContents, settings.theme);
  try {
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  } catch {
    logger.warn('login_item_settings_failed');
  }
  const themeWc = activeContents();
  if (themeWc) {
    applyThemeToWebContents(
      themeWc,
      settings.accentColor || DEFAULT_ACCENT_COLOR,
      settings.fontScale || 1
    ).catch((err) => {
      logger.warn('theme_apply_failed', { error: String(err) });
    });
  }
};

const createSettingsWindow = (): void => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 660,
    height: 560,
    resizable: false,
    title: 'Preferences',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences(path.join(__dirname, 'preload.js')),
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  void settingsWindow.loadFile(localPage('settings'));
};

const openVaultWindow = (): void => {
  if (vaultWindow && !vaultWindow.isDestroyed()) {
    vaultWindow.focus();
    return;
  }

  vaultWindow = new BrowserWindow({
    width: 860,
    height: 640,
    resizable: true,
    title: 'Document Vault',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences(path.join(__dirname, 'preload.js')),
  });

  vaultWindow.on('closed', () => {
    vaultWindow = null;
  });

  void vaultWindow.loadFile(localPage('vault'));
};

const navigateToDeepLink = (ycUrl: string): void => {
  const href = deepLinkToUrl(ycUrl, config);
  const wc = activeContents();
  if (href && wc) {
    void wc.loadURL(href);
    focusMainWindow();
  } else {
    logger.warn('deep_link_navigation_failed', { url: ycUrl });
  }
};

// Single source of truth for executing a command-palette action by id. Used by
// the palette (IPC), the tray quick actions, and any other trigger so they all
// use the correct routes and the in-page action injection.
const runTabCommand = (id: string): void => {
  switch (id) {
    case 'tab:new':
      newTab();
      break;
    case 'tab:close':
      closeActiveTab();
      break;
    case 'tab:reopen':
      reopenClosedTab();
      break;
    case 'tab:search':
      openTabSearch();
      break;
    case 'tab:toggle-vertical':
      setTabOrientation(tabOrientation === 'vertical' ? 'horizontal' : 'vertical');
      break;
    case 'tab:toggle-split':
      if (splitId) {
        setSplitTab(null);
      } else {
        // layoutContentPanes ignores a split that equals the active tab, so the
        // split must be a DIFFERENT tab. Pick the next tab after the active one
        // (wrapping); if there's only one tab, leave the split closed.
        const state = tabManager?.getState();
        const tabs = state?.tabs ?? [];
        const activeId = attachedTabId ?? state?.activeId ?? null;
        const activeIndex = tabs.findIndex((t) => t.id === activeId);
        const other =
          tabs.length > 1
            ? tabs[(Math.max(0, activeIndex) + 1) % tabs.length]?.id ?? null
            : null;
        if (other && other !== activeId) setSplitTab(other);
      }
      break;
  }
};

const runUrlCommand = async (
  action: (typeof BUILTIN_ACTIONS)[number],
  wc: WebContents
): Promise<void> => {
  if (!action.url) return;
  const href = deepLinkToUrl(action.url, config);
  if (!href) {
    logger.warn('command_action_route_unresolved', {
      id: action.id,
      url: action.url,
    });
    return;
  }
  await wc.loadURL(href);
  focusMainWindow();
  const trigger = PAGE_ACTION_TRIGGERS[action.id];
  if (trigger) {
    void wc
      .executeJavaScript(buildPageActionScript(trigger), true)
      .catch((error) => logger.warn('page_action_inject_failed', { id: action.id, error }));
  }
};

const runCommandAction = async (id: string): Promise<void> => {
  const action = BUILTIN_ACTIONS.find((a) => a.id === id);
  if (!action) {
    logger.warn('command_action_unknown', { id });
    return;
  }
  if (recentsStore && action.url) {
    recentsStore.recordVisit(action.url, action.label, action.id);
  }
  if (action.id === 'open-settings') {
    createSettingsWindow();
    return;
  }
  if (id.startsWith('tab:')) {
    runTabCommand(id);
    return;
  }
  const wc = activeContents();
  if (action.url && wc) {
    await runUrlCommand(action, wc);
  }
};

const openCommandPalette = (): void => {
  if (commandPaletteWindow && !commandPaletteWindow.isDestroyed()) {
    commandPaletteWindow.focus();
    return;
  }

  const focusedDisplay = BrowserWindow.getFocusedWindow()?.getBounds() || {
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  };
  const paletteWidth = 560;
  const paletteHeight = 410;
  const x = Math.round(focusedDisplay.x + (focusedDisplay.width - paletteWidth) / 2);
  const y = Math.round(focusedDisplay.y + 60);

  commandPaletteWindow = new BrowserWindow({
    width: paletteWidth,
    height: paletteHeight,
    x,
    y,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'Command Palette',
    backgroundColor: '#0b0d12',
    show: false,
    webPreferences: secureWebPreferences(path.join(__dirname, 'preload.js')),
  });

  commandPaletteWindow.on('blur', () => {
    if (commandPaletteWindow && !commandPaletteWindow.isDestroyed()) {
      commandPaletteWindow.close();
    }
  });

  commandPaletteWindow.on('closed', () => {
    commandPaletteWindow = null;
  });

  commandPaletteWindow.once('ready-to-show', () => {
    commandPaletteWindow?.show();
    commandPaletteWindow?.focus();
  });

  void commandPaletteWindow.loadFile(localPage('command-palette'));
};

// Opt-in idle auto-lock (YC_DESKTOP_IDLE_LOCK_MINUTES). On lock, clears the
// session and returns to sign-in so a fresh login is required.
// When biometric lock is available and enabled, locks biometric instead of
// clearing the session — requiring Touch ID / Windows Hello to resume.
const setupIdleLock = (ses: Session): void => {
  // Prefer the persisted Preferences value (read live each tick so toggling
  // "Idle auto-lock" applies without a restart); fall back to the env override.
  const resolveIdleMinutes = (): number => {
    const minutes = settingsStore?.load().idleLockMinutes;
    return typeof minutes === 'number' && minutes > 0
      ? minutes
      : (idleLockMinutesFromEnv(process.env) ?? 0);
  };
  let locked = false;
  setInterval(() => {
    const idleMinutes = resolveIdleMinutes();
    if (!idleMinutes) return;
    const idleMs = powerMonitor.getSystemIdleTime() * 1000;
    if (!locked && shouldLockAfterIdle(Date.now() - idleMs, Date.now(), idleMinutes)) {
      locked = true;
      logger.warn('idle_lock_engaged', { idleMinutes });

      const bio = biometricLock;
      const settings = settingsStore?.load();
      if (bio && bio.isAvailable() && settings?.biometricLockEnabled) {
        bio.lock();
        logger.info('biometric_lock_engaged');
        void bio.authenticate('Unlock Yosemite Crew PIMS').then((ok) => {
          if (ok) {
            locked = false;
            logger.info('biometric_unlock_success');
          } else {
            logger.warn('biometric_unlock_failed');
            void ses.clearStorageData({ storages: ['cookies'] }).finally(() => {
              persistAuthHint(false);
              loadStartUrl();
            });
          }
        });
      } else {
        void ses.clearStorageData({ storages: ['cookies'] }).finally(() => {
          persistAuthHint(false);
          loadStartUrl();
        });
      }
    } else if (locked && idleMs < 1000) {
      locked = false;
    }
  }, 30_000);
};

// exportDiagnostics extracted to src/ui/status-dialogs.ts

let unreadCount = 0;

const updateUnreadBadge = (): void => {
  if (unreadCount > 0) {
    const text = unreadCount > 99 ? '99+' : String(unreadCount);
    app.dock?.setBadge(text);
  } else {
    app.dock?.setBadge('');
  }
};

// Reset the real unread counter (the module-level value that updateUnreadBadge
// reads) and refresh the dock badge.
const clearUnread = (): void => {
  unreadCount = 0;
  updateUnreadBadge();
};

// Real-fs deps for the rollback tracker. Without these, readTracker returns a
// default and recordCrash/resetTracker never persist, so rollback can't work.
const rollbackFsDeps = {
  readFileSync: (p: string, enc: string): string => fs.readFileSync(p, enc as BufferEncoding),
  writeFileSync: (p: string, data: string, enc: string): void =>
    fs.writeFileSync(p, data, enc as BufferEncoding),
  mkdirSync: (p: string, options: { recursive: boolean }): void => {
    fs.mkdirSync(p, options);
  },
  pathDirname: (p: string): string => path.dirname(p),
};

const offlineCacheCrypto = (): {
  encryptString?: (plain: string) => Buffer;
  decryptString?: (encrypted: Buffer) => string;
} => ({
  encryptString: safeStorage.isEncryptionAvailable()
    ? (plain: string) => safeStorage.encryptString(plain)
    : undefined,
  decryptString: safeStorage.isEncryptionAvailable()
    ? (encrypted: Buffer) => safeStorage.decryptString(encrypted)
    : undefined,
});

const notificationRuntimeConfig = (): {
  enabled: boolean;
  start: string;
  end: string;
  notificationsEnabled: boolean;
} => {
  const s = settingsStore?.load() || DEFAULT_SETTINGS;
  return {
    enabled: true,
    start: s.dndStart,
    end: s.dndEnd,
    notificationsEnabled: s.notificationsEnabled,
  };
};

const showDesktopNotification = (
  title: string,
  body: string,
  opts?: { silent?: boolean }
): boolean => {
  try {
    const n = new Notification({ title, body, silent: opts?.silent ?? false });
    n.on('click', () => {
      focusMainWindow();
    });
    n.show();
    return true;
  } catch {
    return false;
  }
};

const canPromptTouchID = (): boolean => {
  try {
    return systemPreferences.canPromptTouchID();
  } catch {
    return false;
  }
};

const promptTouchID = async (reason: string): Promise<boolean> => {
  try {
    await systemPreferences.promptTouchID(reason);
    return true;
  } catch {
    return false;
  }
};

const moveMainWindowBy = (dx: number, dy: number): void => {
  const win = mainWindow;
  if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
  const [x = 0, y = 0] = win.getPosition();
  win.setPosition(Math.round(x + dx), Math.round(y + dy));
};

// Auto-rollback: read the tracker left by the previous session. A non-zero
// crash count means the previous session didn't cleanly exit (crashed /
// force-killed). If the threshold is met within the time window, trigger a
// rollback to the previous known-good version channel.
const applyRollbackDecision = (): void => {
  const trackerPath = path.join(app.getPath('userData'), ROLLBACK_FILENAME);
  const appVersion = app.getVersion();
  rollbackTracker = readTracker(trackerPath, rollbackFsDeps);
  const decision = evaluateRollback(rollbackTracker, appVersion);
  if (decision.shouldRollback) {
    logger.warn('rollback_triggered', {
      reason: decision.reason,
      tracker: rollbackTracker,
    });
  } else if (rollbackTracker.crashCount > 0) {
    logger.warn('previous_session_crashed', {
      crashCount: rollbackTracker.crashCount,
    });
    // Carry forward the crash count so the current session can also
    // contribute if it crashes too.
    rollbackTracker = recordCrash(trackerPath, appVersion, rollbackFsDeps);
  } else {
    rollbackTracker = resetTracker(trackerPath, appVersion, rollbackFsDeps);
  }
};

// Off by default. Opt in with YC_DESKTOP_LOCAL_API=1. When enabled the
// server binds loopback only, validates the Host header, and requires a
// bearer token written to userData/local-api-token (mode 0600).
const maybeStartLocalApi = (): void => {
  if (process.env.YC_DESKTOP_LOCAL_API !== '1') return;
  localApi = createLocalApiServer({
    port: 18799,
    logger,
    getSettings: () => (settingsStore?.load() || {}) as Record<string, unknown>,
    handleNavigate: (url: string) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const href = deepLinkToUrl(url, config);
      if (!href) return;
      // In tab mode the visible page is a WebContentsView, so loading into the
      // main window's webContents would be invisible. Target the active tab's
      // contents (activeContents falls back to the main window outside tab mode).
      const wc = activeContents();
      if (!wc) return;
      wc.loadURL(href).catch((err) => {
        logger.warn('navigate_deep_link_failed', { error: String(err) });
      });
    },
  });
  const startedApi = localApi;
  startedApi
    .start()
    .then(() => {
      try {
        fs.writeFileSync(
          path.join(app.getPath('userData'), 'local-api-token'),
          startedApi.getToken(),
          { mode: 0o600 }
        );
      } catch (error) {
        logger.warn('local_api_token_write_failed', { error });
      }
    })
    .catch((err) => {
      logger.warn('local_api_start_failed', { error: String(err) });
    });
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

if (gotSingleInstanceLock) {
  app.setAppUserModelId('com.yosemitecrew.pims');
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Never override an invalid/untrusted TLS certificate — always reject and log.
  app.on('certificate-error', (event, _webContents, url, error, _certificate, callback) => {
    event.preventDefault();
    logger.error('certificate_rejected', { url, error });
    callback(false);
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => handleWindowOpen(url));
    // Apply navigation policy to any popup this webContents opens, so an allowed
    // in-app popup cannot redirect in-place to an external/blocked URL and remain
    // inside the desktop shell.
    contents.on('did-create-window', (childWindow) => {
      childWindow.webContents.on('will-navigate', handleMainNavigation);
      childWindow.webContents.on('will-redirect', handleMainNavigation);
    });
    contents.on('will-attach-webview', (event) => {
      logger.warn('webview_attach_blocked');
      event.preventDefault();
    });
    contents.on('context-menu', (_e, params) => {
      const menu = buildContextMenu(params, contents);
      if (menu) menu.popup();
    });
  });

  app.on('second-instance', (_event, argv) => {
    focusMainWindow();
    const link = deepLinkFromArgv(argv);
    if (link) handleDeepLink(link);
  });

  void app.whenReady().then(
    async () => {
      logger = createLogger({ logDir: app.getPath('logs') });
      logger.info('app_ready', {
        version: app.getVersion(),
        isPackaged: app.isPackaged,
      });
      configureOnlineTracking();
      createCrashReporter({ app, crashReporter, logger });
      wireCrashLogging({ app, logger });
      app.setAboutPanelOptions({
        ...aboutPanelOptions(app.getVersion()),
        iconPath: getIconPath(),
      });
      windowStateStore = createWindowStateStore(
        path.join(app.getPath('userData'), 'window-state.json'),
        { logger }
      );
      settingsStore = createSettingsStore(path.join(app.getPath('userData'), 'settings.json'));
      recentsStore = createRecentsStore(app.getPath('userData'));
      offlineCache = createOfflineCache(app.getPath('userData'), offlineCacheCrypto());
      notificationManager = createNotificationManager(notificationRuntimeConfig, {
        isSupported: () => Notification.isSupported(),
        showNotification: showDesktopNotification,
      });
      biometricLock = createBiometricLock({ canPromptTouchID, promptTouchID });
      const initialSettings = settingsStore.load();
      applySettings(initialSettings);
      signedInBefore = loadSignedInHint();
      // Seed in-memory auth state from the hint so we don't re-notify "signed in"
      // on every launch when the session is already active.
      authState = signedInBefore ? 'signed-in' : 'signed-out';
      // IMPORTANT: many of these module variables are (re)assigned AFTER this
      // call — `mainWindow`/`tabManager`/`tabViewHost`/`saveSession` by
      // createMainWindow, and the compliance/vault/sync services by their async
      // setup steps below. The IPC handlers read these fields live at call time,
      // so they MUST be live getters: passing the values by shorthand here would
      // freeze them as the `null` snapshots that exist right now, silently
      // disabling the entire tab/vault/compliance/sync IPC surface (this is what
      // made the tab strip render empty). Getters also keep `attachedTabId` a
      // single source of truth shared with main.ts's own tab functions.
      registerIpcHandlers({
        config,
        logger,
        localFileRoot: __dirname,
        brandPrefix: BRAND_PREFIX,
        productName: PRODUCT_NAME,
        chromeStripHeight: CHROME_STRIP_HEIGHT,
        verticalTabWidth: VERTICAL_TAB_WIDTH,
        get mainWindow() {
          return mainWindow;
        },
        activeContents,
        onNavigate: handleMainNavigation,
        onWindowOpen: handleWindowOpen,
        loadStartUrl,
        enterTabMode,
        exitTabMode,
        runCommandAction,
        get tabMode() {
          return tabMode;
        },
        get tabManager() {
          return tabManager;
        },
        get tabViewHost() {
          return tabViewHost;
        },
        get attachedTabId() {
          return attachedTabId;
        },
        set attachedTabId(value) {
          attachedTabId = value;
        },
        get tabOrientation() {
          return tabOrientation;
        },
        get splitId() {
          return splitId;
        },
        get tabChromeView() {
          return tabChromeView;
        },
        layoutTabChrome,
        setTabSearch,
        setSplitTab,
        setTabOrientation,
        get saveSession() {
          return saveSession;
        },
        get commandPaletteWindow() {
          return commandPaletteWindow;
        },
        get settingsWindow() {
          return settingsWindow;
        },
        openVaultWindow,
        navigateToDeepLink,
        get settingsStore() {
          return settingsStore;
        },
        applySettings,
        get recentsStore() {
          return recentsStore;
        },
        get offlineCache() {
          return offlineCache;
        },
        get notificationManager() {
          return notificationManager;
        },
        get biometricLock() {
          return biometricLock;
        },
        get documentVault() {
          return documentVault;
        },
        get syncEngine() {
          return syncEngine;
        },
        get offlineStore() {
          return offlineStore;
        },
        get keyboardShortcutManager() {
          return keyboardShortcutManager;
        },
        get auditLog() {
          return auditLog;
        },
        get controlledSubstanceLog() {
          return controlledSubstanceLog;
        },
        get csExport() {
          return csExport;
        },
        get deaTracker() {
          return deaTracker;
        },
        get lastOfflineSyncResults() {
          return lastOfflineSyncResults;
        },
        get lastOfflineSyncError() {
          return lastOfflineSyncError;
        },
        getSyncStatusSummary,
        runOfflineFullSync,
        clearLocalDesktopData,
        get unreadCount() {
          return unreadCount;
        },
        set unreadCount(value) {
          unreadCount = value;
        },
        updateUnreadBadge,
        startTelehealth,
        moveWindowBy: moveMainWindowBy,
      });
      applyRollbackDecision();
      let pendingTabModeUrl: string | undefined;
      ({
        mainWindow,
        tabManager,
        tabViewHost,
        saveSession,
        coldStartWatchdog,
        enterTabModeUrl: pendingTabModeUrl,
      } = await createMainWindow({
        config,
        logger,
        productName: PRODUCT_NAME,
        brandPrefix: BRAND_PREFIX,
        windowStateStore,
        tabMode: () => tabMode,
        attachedTabId: () => attachedTabId,
        splitId: () => splitId,
        tabOrientation: () => tabOrientation,
        setTabSearch,
        setSplitTab,
        setTabOrientation,
        activeContents,
        enterTabMode,
        layoutTabChrome,
        loadStartUrl,
        showOfflinePage,
        consumePendingDeepLink,
        trackAuthNavigation,
        configureDownloads,
        configureOfflineServe,
        offlineCache: offlineCache,
        settingsStore,
        signedInBefore,
        reloadGuard,
        clearUnread,
        openCommandPalette,
        createSettingsWindow,
        newTab,
        closeActiveTab,
        reopenClosedTab,
        openTabSearch,
        verifyAuditTrail: statusDlg.verifyAuditTrail,
        exportCsDailyLog: statusDlg.exportCsDailyLog,
        showDeaStatus: statusDlg.showDeaStatus,
        generateDeaReportAction: statusDlg.generateDeaReportAction,
        showPmpStatus: statusDlg.showPmpStatus,
        openVaultWindow,
        showVaultInfo: statusDlg.showVaultInfo,
        backUpNow: statusDlg.backUpNow,
        savePageAsPdf: statusDlg.savePageAsPdf,
        openOnSecondScreen: statusDlg.openOnSecondScreen,
        showPrintStatus: statusDlg.showPrintStatus,
        startTelehealth,
        exportDiagnostics: statusDlg.exportDiagnostics,
      }));
      // enterTabMode reads the module window/tab globals assigned just above, so
      // it must run here (not inside createMainWindow) to actually take effect.
      if (pendingTabModeUrl) {
        enterTabMode(pendingTabModeUrl);
        repaintActiveTabOnShow();
      }
      tray = setupTray({
        productName: PRODUCT_NAME,
        mainWindow,
        logger,
        iconPath: getIconPath(),
        runCommandAction,
        checkForUpdatesManually: (d) =>
          checkForUpdatesManually({ ...d, preferredChannel: settingsStore?.load().updateChannel }),
      });
      // Telemetry is fire-and-forget: setupTelemetry records app_ready and keeps
      // its own flush timer alive, so we don't retain the client here.
      setupTelemetry({ logger });
      // Run after the window's initial load so the synchronous safeStorage
      // keychain prompt (audit key) can't stall cold-start navigation.
      const compliance = await setupCompliance({
        logger,
        userData: app.getPath('userData'),
      });
      auditLog = compliance.auditLog;
      controlledSubstanceLog = compliance.controlledSubstanceLog;
      offlineAuditTrail = compliance.offlineAuditTrail;
      deaTracker = compliance.deaTracker;
      deaReminder = compliance.deaReminder;
      dualWitnessLog = compliance.dualWitnessLog;
      pmpService = compliance.pmpService;
      csExport = compliance.csExport;

      const vault = setupVaultAndBackup({
        logger,
        userData: app.getPath('userData'),
        safeStorage,
      });
      documentVault = vault.documentVault;
      backupService = vault.backupService;
      backupTimer = vault.backupTimer;

      statusImpl = createStatusDialogService({
        logger,
        dialog,
        safeStorage,
        screen,
        app,
        config,
        auditLog,
        csExport,
        deaReminder,
        deaTracker,
        controlledSubstanceLog,
        pmpService,
        dualWitnessLog,
        offlineAuditTrail,
        documentVault,
        backupService,
        runBackup,
        mainWindow,
        secondaryDisplays,
        labelPrintService,
        printService,
        activeContents,
        refreshPrinters,
      });

      void setupOfflineSync({
        logger,
        net,
        endpoint: process.env.YC_DESKTOP_SYNC_URL,
      }).then((sync) => {
        offlineStore = sync.offlineStore;
        syncEngine = sync.syncEngine;
        offlineSyncTimer = sync.offlineSyncTimer;
      });

      const native = setupNativeSurfaces({
        app,
        screen,
        BrowserWindow,
        Menu,
        secureWebPreferences,
        logger,
        mainWindow,
        focusMainWindow,
        activeContents,
        checkForUpdatesManually: (d) =>
          checkForUpdatesManually({ ...d, preferredChannel: settingsStore?.load().updateChannel }),
        cachedPrinterNames,
        refreshPrinters,
      });
      secondaryDisplays = native.secondaryDisplays;
      printService = native.printService;
      labelPrintService = native.labelPrintService;
      if (offlineCache) offlineCache.clearExpired();
      {
        syncQueue = createSyncQueue(app.getPath('userData'));
        const transport = {
          send: async (_mutation: {
            type: string;
            entityType: string;
            entityId: string;
            data: Record<string, unknown> | null;
          }) => {
            logger.debug('sync_transport_send', { mutation: _mutation });
            return { ok: true };
          },
        };
        syncDaemon = createSyncDaemon({
          queue: syncQueue,
          transport,
          isOnline: () => net.isOnline(),
          onOnline: (cb) => (app as { on(e: string, cb: () => void): void }).on('online', cb),
          onOffline: (cb) => (app as { on(e: string, cb: () => void): void }).on('offline', cb),
          logger,
          flushIntervalMs: 30_000,
        });
        syncDaemon.start();
      }
      maybeStartLocalApi();
      keyboardShortcutManager = createKeyboardShortcutManager({
        globalShortcut,
        focusedWebContents: () => mainWindow?.webContents ?? null,
        openPalette: openCommandPalette,
        navigate: navigateToDeepLink,
        logger,
      });
      keyboardShortcutManager.register();
      if (mainWindow) setupIdleLock(mainWindow.webContents.session);
      const link = deepLinkFromArgv(process.argv);
      if (link) handleDeepLink(link);
    },
    (error) => {
      logger.error('app_ready_failed', { error });
      app.quit();
    }
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow({
        config,
        logger,
        productName: PRODUCT_NAME,
        brandPrefix: BRAND_PREFIX,
        windowStateStore,
        tabMode: () => tabMode,
        attachedTabId: () => attachedTabId,
        splitId: () => splitId,
        tabOrientation: () => tabOrientation,
        setTabSearch,
        setSplitTab,
        setTabOrientation,
        activeContents,
        enterTabMode,
        layoutTabChrome,
        loadStartUrl,
        showOfflinePage,
        consumePendingDeepLink,
        trackAuthNavigation,
        configureDownloads,
        configureOfflineServe,
        offlineCache: offlineCache,
        settingsStore,
        signedInBefore,
        reloadGuard,
        clearUnread,
        openCommandPalette,
        createSettingsWindow,
        newTab,
        closeActiveTab,
        reopenClosedTab,
        openTabSearch,
        verifyAuditTrail: statusDlg.verifyAuditTrail,
        exportCsDailyLog: statusDlg.exportCsDailyLog,
        showDeaStatus: statusDlg.showDeaStatus,
        generateDeaReportAction: statusDlg.generateDeaReportAction,
        showPmpStatus: statusDlg.showPmpStatus,
        openVaultWindow,
        showVaultInfo: statusDlg.showVaultInfo,
        backUpNow: statusDlg.backUpNow,
        savePageAsPdf: statusDlg.savePageAsPdf,
        openOnSecondScreen: statusDlg.openOnSecondScreen,
        showPrintStatus: statusDlg.showPrintStatus,
        startTelehealth,
        exportDiagnostics: statusDlg.exportDiagnostics,
      }).then((output) => {
        mainWindow = output.mainWindow;
        tabManager = output.tabManager;
        tabViewHost = output.tabViewHost;
        saveSession = output.saveSession;
        coldStartWatchdog = output.coldStartWatchdog;
        if (output.enterTabModeUrl) {
          enterTabMode(output.enterTabModeUrl);
          // Same hidden-window repaint fix as cold start: the reopened window is
          // created hidden and shown async, so the restored tab must be re-laid-out
          // on show or it stays stuck behind the loading splash.
          repaintActiveTabOnShow();
        }
      });
    }
  });

  app.on('will-quit', () => {
    tray?.destroy();
    tabViewHost?.destroyAll();
    coldStartWatchdog?.cancel();
    localApi?.stop().catch((err) => {
      logger.warn('local_api_stop_failed', { error: String(err) });
    });
    syncDaemon?.stop();
    if (offlineSyncTimer) clearInterval(offlineSyncTimer);
    if (backupTimer) clearInterval(backupTimer);
    try {
      offlineStore?.close();
    } catch {
      // store may not be initialized
    }
    // Drain pending cache writes before shutdown (Phase 1c).
    if (offlineCache) {
      offlineCache
        .flush()
        .catch((err) => logger.warn('offline_cache_flush_failed', { error: String(err) }));
    }
    keyboardShortcutManager?.unregister();
    globalShortcut.unregisterAll();
    // Reset the rollback tracker on clean exit so the next launch doesn't
    // inherit stale crash counts from a healthy session.
    const trackerPath = path.join(app.getPath('userData'), ROLLBACK_FILENAME);
    resetTracker(trackerPath, app.getVersion(), rollbackFsDeps);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

export {
  openExternal,
  handleWindowOpen,
  handleMainNavigation,
  buildContextMenu,
  childWindowOptions,
  deepLinkFromArgv,
  shouldGrantPermission,
} from './shell/window-config';

export { normalizeWindowState } from './core/window-state';
