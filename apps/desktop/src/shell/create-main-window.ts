"use strict";

import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, screen, type Session } from "electron";
import { classifyNavigation } from "../core/navigation-policy";
import type { DesktopConfig } from "../core/navigation-policy";
import { createTabManager } from "../core/tab-manager";
import { createTabViewHost } from "../ui/tab-view-host";
import { clampToVisibleDisplays, manageWindow } from "../core/window-state";
import type { WindowStateStore } from "../core/window-state";
import { createAppMenu } from "../ui/app-menu";
import {
  createColdStartWatchdog,
  type ColdStartWatchdog,
} from "../core/cold-start-watchdog";
import { initAutoUpdates, checkForUpdatesManually } from "../lifecycle/updater";
import { DEFAULT_SETTINGS } from "../utils/settings-store";
import type { SettingsStore } from "../utils/settings-store";
import { createCacheEntry, type OfflineCache } from "../sync/offline-cache";
import { HELP_LINKS } from "../ui/branding";
import { STREAM_TELEHEALTH_PROVIDER } from "../utils/telehealth";
import type { DesktopLogger } from "../utils/logger";
import {
  secureWebPreferences,
  configureSessionPermissions,
  handleWindowOpen,
  handleMainNavigation,
  getCacheStrategy,
} from "./window-config";
import {
  desktopLocalPage,
  desktopPreloadPath,
  desktopResourcePath,
} from "./paths";

export interface CreateMainWindowDeps {
  config: DesktopConfig;
  logger: DesktopLogger;
  productName: string;
  brandPrefix: string;
  windowStateStore: WindowStateStore | null;

  // Tab system. Live getters (not snapshots) so the app menu, which is built
  // once, always reads the current tab state at click time.
  tabMode: () => boolean;
  attachedTabId: () => string | null;
  splitId: () => string | null;
  tabOrientation: () => "horizontal" | "vertical";
  setTabSearch: (open: boolean) => void;
  setSplitTab: (id: string | null) => void;
  setTabOrientation: (mode: "horizontal" | "vertical") => void;
  activeContents: () => Electron.WebContents | null;
  enterTabMode: (url: string) => void;
  layoutTabChrome: () => void;

  // Navigation
  loadStartUrl: () => void;
  showOfflinePage: (reason: string) => void;
  consumePendingDeepLink: () => void;
  trackAuthNavigation: (rawUrl: string) => void;

  // Session configuration (stay in main.ts — capture module-level mutable vars)
  configureDownloads: (ses: Session) => void;
  configureOfflineServe: (ses: Session) => void;

  // Misc state
  offlineCache: OfflineCache | null;
  settingsStore: SettingsStore | null;
  signedInBefore: boolean;
  reloadGuard: { shouldReload: () => boolean; reset: () => void };
  clearUnread: () => void;

  // Menu actions
  openCommandPalette: () => void;
  createSettingsWindow: () => void;
  newTab: (url?: string) => void;
  closeActiveTab: () => void;
  reopenClosedTab: () => void;
  openTabSearch: () => void;
  verifyAuditTrail: () => void;
  exportCsDailyLog: () => void;
  showDeaStatus: () => void;
  generateDeaReportAction: () => void;
  showPmpStatus: () => void;
  openVaultWindow: () => void;
  showVaultInfo: () => void;
  backUpNow: () => Promise<void>;
  savePageAsPdf: () => Promise<void>;
  openOnSecondScreen: () => void;
  showPrintStatus: () => void;
  startTelehealth: (intent?: Record<string, unknown>) => string;
  exportDiagnostics: (window: BrowserWindow | null) => Promise<void>;
}

export interface CreateMainWindowOutput {
  mainWindow: BrowserWindow;
  tabManager: ReturnType<typeof createTabManager>;
  tabViewHost: ReturnType<typeof createTabViewHost>;
  saveSession: () => void;
  coldStartWatchdog: ColdStartWatchdog;
  // When set, the caller must call enterTabMode(url) AFTER assigning the module
  // window/tab globals. Calling it from inside createMainWindow would no-op
  // because those globals are only wired up once this function resolves.
  enterTabModeUrl?: string;
}

export const createMainWindow = async (
  deps: CreateMainWindowDeps,
): Promise<CreateMainWindowOutput> => {
  if (!deps.windowStateStore) {
    throw new Error(
      "Window state store must be initialized before creating the main window.",
    );
  }

  const restored = clampToVisibleDisplays(
    deps.windowStateStore.load(),
    screen.getAllDisplays(),
  );

  const mainWindow = new BrowserWindow({
    width: restored.width,
    height: restored.height,
    x: restored.x,
    y: restored.y,
    minWidth: 1024,
    minHeight: 700,
    title: deps.productName,
    backgroundColor: "#ffffff",
    show: false,
    icon: desktopResourcePath("icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    titleBarStyle: process.platform === "darwin" ? "hidden" : undefined,
    trafficLightPosition:
      process.platform === "darwin" ? { x: 12, y: 10 } : undefined,
    ...(process.platform === "darwin" ? {} : { frame: false }),
    webPreferences: secureWebPreferences(desktopPreloadPath()),
  });

  if (restored.isMaximized) mainWindow.maximize();

  const ses = mainWindow.webContents.session;
  configureSessionPermissions(ses);
  deps.configureDownloads(ses);
  deps.configureOfflineServe(ses);
  manageWindow(
    mainWindow as unknown as Parameters<typeof manageWindow>[0],
    deps.windowStateStore,
  );

  const sp = path.join(app.getPath("userData"), "tab-session.json");
  let tabManager = createTabManager();
  const loadSession = (): void => {
    try {
      const raw = fs.readFileSync(sp, "utf8");
      tabManager = createTabManager();
      tabManager.restore(
        raw,
        (url) =>
          classifyNavigation(url, deps.config).disposition === "internal",
      );
    } catch {
      tabManager = createTabManager();
    }
  };
  loadSession();
  const saveSession = (): void => {
    if (!tabManager) return;
    try {
      fs.mkdirSync(path.dirname(sp), { recursive: true });
      fs.writeFileSync(sp, tabManager.persist(), "utf8");
    } catch {
      /* persist must never break the app */
    }
  };

  // Populate the offline cache from a finished page load. Shared between the main
  // window and tab WebContentsViews so cached content is identical regardless of
  // where the page rendered. Only successful internal documents are stored.
  const cachePageFromContents = (
    wc: Electron.WebContents,
    httpStatus: number,
  ): void => {
    const loadedUrl = wc.getURL() || "";
    const statusOk = httpStatus >= 200 && httpStatus < 300;
    if (
      !deps.offlineCache ||
      !statusOk ||
      classifyNavigation(loadedUrl, deps.config).disposition !== "internal"
    ) {
      return;
    }
    if (wc.isDestroyed()) return;
    wc.executeJavaScript(
      "({ title: document.title, html: document.documentElement.outerHTML })",
      false,
    )
      .then((result: unknown) => {
        if (!result || typeof result !== "object") return;
        const { title, html } = result as { title?: unknown; html?: unknown };
        if (typeof html !== "string") return;
        const safeTitle = typeof title === "string" ? title : "";
        const MAX_CACHED_HTML_BYTES = 5 * 1024 * 1024;
        if (Buffer.byteLength(html, "utf8") > MAX_CACHED_HTML_BYTES) {
          deps.logger.debug("nav_cache_skipped_too_large", { url: loadedUrl });
          return;
        }
        const strategy = getCacheStrategy(loadedUrl);
        deps.logger.debug("offline_cache_navigation", {
          url: loadedUrl,
          title: safeTitle,
          bytes: Buffer.byteLength(html, "utf8"),
          strategy,
        });
        deps.offlineCache?.set(
          createCacheEntry(loadedUrl, html, "text/html", 200, {
            "x-yc-title": safeTitle,
            "x-cache-strategy": strategy,
          }),
        );
      })
      .catch((err) => {
        deps.logger.warn("nav_cache_failed", { error: String(err) });
      });
  };

  const webPrefs = secureWebPreferences(desktopPreloadPath());
  const tabViewHost = createTabViewHost({
    logger: deps.logger,
    webPreferences: webPrefs!,
    onWindowOpen: handleWindowOpen,
    onNavigate: handleMainNavigation,
    onDidFinishLoad: (_id, wc, httpStatus) => cachePageFromContents(wc, httpStatus),
    onUpdate: (id, meta) => {
      tabManager?.updateMeta(id, meta);
      // The web app — where the user actually signs in and out — lives in the
      // tab, not the main window. Feed the tab's in-app navigations into auth
      // tracking so a web sign-out is detected; otherwise the signed-in hint is
      // never cleared and the welcome screen stays skipped on the next launch.
      if (
        typeof meta.url === "string" &&
        classifyNavigation(meta.url, deps.config).disposition === "internal"
      ) {
        deps.trackAuthNavigation(meta.url);
      }
      saveSession();
    },
    onLoadError: (id, info) => {
      // Only take over the screen when the failed tab is the visible one;
      // a background tab failing shouldn't replace what the user is viewing.
      if (id === deps.attachedTabId()) {
        deps.showOfflinePage(info.error || `Could not reach ${info.url}`);
      }
    },
    getZoom: (id) => {
      const state = tabManager?.getState();
      const tab = state?.tabs.find((t) => t.id === id);
      return tab?.zoom ?? 1;
    },
  });
  const initialTabs = tabManager?.getState().tabs || [];
  for (const t of initialTabs) {
    if (t.zoom !== 1) tabViewHost?.setZoom(t.id, t.zoom);
  }

  const mw = mainWindow;
  mw.on("resize", () => {
    if (mw.isDestroyed()) return;
    deps.layoutTabChrome();
  });

  const ensureVisible = (): void => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };
  mainWindow.once("ready-to-show", ensureVisible);
  setTimeout(ensureVisible, 3000);

  mainWindow.webContents.on("will-navigate", handleMainNavigation);
  mainWindow.webContents.on("will-redirect", handleMainNavigation);

  mainWindow.on("page-title-updated", (event, title) => {
    event.preventDefault();
    const trimmed = (title || "").trim();
    const prefixPattern = deps.brandPrefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      String.raw`\$&`,
    );
    const hasBrand = new RegExp(prefixPattern, "i").test(trimmed);
    if (hasBrand) {
      mainWindow?.setTitle(trimmed);
    } else {
      mainWindow?.setTitle(
        trimmed ? `${trimmed} — ${deps.productName}` : deps.productName,
      );
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      if (validatedUrl.startsWith("file:")) {
        deps.logger.error("local_page_load_failed", {
          errorCode,
          errorDescription,
          validatedUrl,
        });
        return;
      }
      if (deps.offlineCache) {
        const cached = deps.offlineCache.get(validatedUrl);
        if (cached && cached.body.length > 0) {
          deps.logger.info("offline_cache_served", { url: validatedUrl });
          void mainWindow?.loadURL(
            "data:text/html;charset=utf-8," +
              encodeURIComponent(cached.body.toString("utf8")),
          );
          return;
        }
      }
      deps.showOfflinePage(
        errorDescription ||
          `Could not reach ${validatedUrl || deps.config.startUrl.href}`,
      );
    },
  );

  // Track the real HTTP status of the last main-frame navigation so the offline
  // cache never stores a 4xx/5xx error or maintenance page as if it were a good
  // document (did-finish-load fires for error pages too).
  let lastMainFrameStatus = 0;
  mainWindow.webContents.on(
    "did-navigate",
    (_event, _url, httpResponseCode) => {
      lastMainFrameStatus =
        typeof httpResponseCode === "number" ? httpResponseCode : 0;
    },
  );

  mainWindow.webContents.on("did-finish-load", () => {
    if (typeof restored.zoomLevel === "number") {
      mainWindow?.webContents.setZoomLevel(restored.zoomLevel);
    }
    const loadedUrl = mainWindow?.webContents.getURL() || "";
    if (loadedUrl && loadedUrl !== "about:blank") {
      coldStartWatchdog?.cancel();
    }
    if (classifyNavigation(loadedUrl, deps.config).disposition === "internal") {
      deps.reloadGuard.reset();
    }
    deps.consumePendingDeepLink();

    // Only cache successful documents — never a 4xx/5xx error or maintenance
    // page, which would then be served verbatim while offline.
    const wc = mainWindow?.webContents;
    if (wc) cachePageFromContents(wc, lastMainFrameStatus);
  });

  const onAuthNavigation = (_event: unknown, url: string) => {
    if (classifyNavigation(url, deps.config).disposition === "internal")
      deps.trackAuthNavigation(url);
  };
  mainWindow.webContents.on("did-navigate", onAuthNavigation);
  mainWindow.webContents.on("did-navigate-in-page", onAuthNavigation);

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    deps.logger.error("renderer_process_gone", details);
    if (details?.reason === "clean-exit") return;
    if (deps.reloadGuard.shouldReload()) {
      deps.loadStartUrl();
    } else {
      deps.logger.error("reload_loop_detected");
      deps.showOfflinePage(
        "Yosemite Crew PIMS stopped responding repeatedly. Please try again.",
      );
    }
  });

  mainWindow.on("unresponsive", () => {
    deps.logger.warn("main_window_unresponsive");
    void dialog
      .showMessageBox(mainWindow, {
        type: "warning",
        buttons: ["Reload", "Wait"],
        defaultId: 0,
        cancelId: 1,
        message: `${deps.productName} is not responding.`,
        detail: "You can reload the workspace or keep waiting.",
      })
      .then((result) => {
        if (result.response === 0) deps.loadStartUrl();
      });
  });

  mainWindow.on("swipe", (_event, direction) => {
    const wc = deps.activeContents();
    if (!wc) return;
    if (direction === "left") wc.navigationHistory.goForward();
    else if (direction === "right") wc.navigationHistory.goBack();
  });

  mainWindow.on("focus", () => {
    deps.clearUnread();
  });

  createAppMenu({
    checkForUpdates: () =>
      void checkForUpdatesManually({ logger: deps.logger }),
    openCommandPalette: deps.openCommandPalette,
    createSettingsWindow: deps.createSettingsWindow,
    newTab: deps.newTab,
    closeActiveTab: deps.closeActiveTab,
    reopenClosedTab: deps.reopenClosedTab,
    openTabSearch: deps.openTabSearch,
    loadStartUrl: deps.loadStartUrl,
    activeContents: deps.activeContents,
    setTabOrientation: (mode) => deps.setTabOrientation(mode),
    tabOrientation: deps.tabOrientation,
    splitId: deps.splitId,
    setSplitTab: (id) => deps.setSplitTab(id),
    tabMode: deps.tabMode,
    attachedTabId: deps.attachedTabId,
    tabManager,
    verifyAuditTrail: deps.verifyAuditTrail,
    exportCsDailyLog: deps.exportCsDailyLog,
    showDeaStatus: deps.showDeaStatus,
    generateDeaReportAction: deps.generateDeaReportAction,
    showPmpStatus: deps.showPmpStatus,
    openVaultWindow: deps.openVaultWindow,
    showVaultInfo: deps.showVaultInfo,
    backUpNow: deps.backUpNow,
    savePageAsPdf: deps.savePageAsPdf,
    openOnSecondScreen: deps.openOnSecondScreen,
    showPrintStatus: deps.showPrintStatus,
    startTelehealth: deps.startTelehealth,
    telehealthProviderName: STREAM_TELEHEALTH_PROVIDER.name,
    exportDiagnostics: deps.exportDiagnostics,
    mainWindow,
    helpLinks: HELP_LINKS,
    productName: deps.productName,
    startUrl: deps.config.startUrl.href,
    logger: deps.logger,
  });

  const ignoreAborted = (error: { message?: string } | string) => {
    const objectMessage = error instanceof Error ? error.message : "";
    const message =
      typeof error === "string" ? error : (error?.message ?? objectMessage);
    if (message.includes("ERR_ABORTED")) return;
    deps.logger.warn("local_page_failed", { error });
  };

  let enterTabModeUrl: string | undefined;
  if (deps.signedInBefore) {
    const launchSettings = deps.settingsStore?.load() || DEFAULT_SETTINGS;
    const lastVer = launchSettings.lastSeenVersion;
    const curVer = app.getVersion();
    if (lastVer && lastVer !== curVer) {
      deps.logger.info("whats_new_shown", { from: lastVer, to: curVer });
      void mainWindow
        .loadFile(desktopLocalPage("whats-new"))
        .then(ensureVisible)
        .catch(ignoreAborted);
    } else {
      void mainWindow
        .loadFile(desktopLocalPage("loading"))
        .then(ensureVisible)
        .catch(ignoreAborted);
      // Defer to the caller: enterTabMode reads module-level window/tab globals
      // that main.ts only assigns after this function resolves.
      enterTabModeUrl = deps.config.startUrl.href;
    }
  } else {
    deps.logger.info("welcome_shown");
    void mainWindow
      .loadFile(desktopLocalPage("welcome"))
      .then(ensureVisible)
      .catch(ignoreAborted);
  }

  const coldStartWatchdog = createColdStartWatchdog({
    getUrl: () => mainWindow?.webContents.getURL() || "",
    onRetry: deps.loadStartUrl,
    logger: deps.logger,
    timeoutMs: 6000,
  });
  coldStartWatchdog.start();

  await initAutoUpdates({ logger: deps.logger });
  return {
    mainWindow,
    tabManager,
    tabViewHost,
    saveSession,
    coldStartWatchdog,
    enterTabModeUrl,
  };
};
