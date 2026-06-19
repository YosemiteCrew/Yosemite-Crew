'use strict';

import { contextBridge, ipcRenderer } from 'electron';

export interface YcDesktop {
  reload: () => Promise<unknown>;
  openInBrowser: () => Promise<unknown>;
  startSignin: () => Promise<unknown>;
  startTelehealth: (intent?: Record<string, unknown>) => Promise<unknown>;
  getSettings: () => Promise<unknown>;
  setSettings: (settings: Record<string, unknown>) => Promise<unknown>;
  executeCommand: (id: string) => Promise<unknown>;
  getPaletteRecents: () => Promise<unknown>;
  getPaletteActions: () => Promise<unknown>;
  closePalette: () => Promise<unknown>;
  getCacheStatus: () => Promise<unknown>;
  clearCache: () => Promise<unknown>;
  getCachedUrls: () => Promise<unknown>;
  getSyncStatus: () => Promise<unknown>;
  syncNow: () => Promise<unknown>;
  clearLocalData: () => Promise<unknown>;
  showNotification: (opts: Record<string, unknown>) => Promise<unknown>;
  authenticateBiometric: (reason?: string) => Promise<unknown>;
  applyTheme: () => Promise<unknown>;
  onShortcut: (callback: (id: string) => void) => () => void;
  openPatientWindow: (patientId: string, name: string) => Promise<unknown>;
  csRecord: (data: Record<string, unknown>) => Promise<unknown>;
  csExport: (date?: string) => Promise<unknown>;
  auditAppend: (entry: Record<string, unknown>) => Promise<unknown>;
  vaultSave: (filename: string, content: string, mimeType?: string) => Promise<unknown>;
  vaultList: () => Promise<unknown>;
  vaultGet: (id: string) => Promise<unknown>;
  vaultDelete: (id: string) => Promise<unknown>;
  vaultStats: () => Promise<unknown>;
  vaultSaveBuffer: (filename: string, base64Content: string, mimeType: string) => Promise<unknown>;
  vaultExport: (id: string) => Promise<unknown>;
  vaultRevealDoc: (id: string) => Promise<unknown>;
  vaultOpen: () => Promise<unknown>;
  deaRegister: (reg: Record<string, unknown>) => Promise<unknown>;
  getCachedContent: (url: string) => Promise<unknown>;
  getTabs: () => Promise<unknown>;
  newTab: (url?: string) => Promise<unknown>;
  closeTab: (id: string) => Promise<unknown>;
  activateTab: (id: string) => Promise<unknown>;
  moveTab: (id: string, toIndex: number) => Promise<unknown>;
  pinTab: (id: string, pinned: boolean) => Promise<unknown>;
  duplicateTab: (id: string) => Promise<unknown>;
  reopenClosedTab: () => Promise<unknown>;
  setTabZoom: (id: string, level: number) => Promise<unknown>;
  tabSearch: (open: boolean) => Promise<unknown>;
  findInPage: (text: string, forward?: boolean, matchCase?: boolean) => Promise<unknown>;
  stopFindInPage: () => Promise<unknown>;
  openDevTools: () => Promise<unknown>;
  closeDevTools: () => Promise<unknown>;
  toggleTabMute: (id: string) => Promise<unknown>;
  getTabPreview: (id: string) => Promise<unknown>;
  detachTab: (id: string) => Promise<unknown>;
  setTabOrientation: (mode: 'horizontal' | 'vertical') => Promise<unknown>;
  setSplitTab: (id: string | null) => Promise<unknown>;
  getAppVersion: () => Promise<string>;
  getLastSeenVersion: () => Promise<string>;
  setLastSeenVersion: (v: string) => Promise<unknown>;
  dismissWhatsNew: () => Promise<unknown>;
  // Manual window drag for the tab bar. A child WebContentsView can't use
  // `-webkit-app-region: drag` without making the whole view (controls included)
  // draggable, so the empty area drives window movement by sending pointer deltas.
  windowDragBy: (dx: number, dy: number) => void;
}

const api: YcDesktop = {
  reload: (): Promise<unknown> => ipcRenderer.invoke('yc:reload'),
  openInBrowser: (): Promise<unknown> => ipcRenderer.invoke('yc:open-in-browser'),
  startSignin: (): Promise<unknown> => ipcRenderer.invoke('yc:start-signin'),
  startTelehealth: (intent?: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:start-telehealth', intent),
  getSettings: (): Promise<unknown> => ipcRenderer.invoke('yc:get-settings'),
  setSettings: (settings: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:set-settings', settings),
  executeCommand: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:execute-command', id),
  getPaletteRecents: (): Promise<unknown> => ipcRenderer.invoke('yc:get-palette-recents'),
  closePalette: (): Promise<unknown> => ipcRenderer.invoke('yc:close-palette'),
  getPaletteActions: (): Promise<unknown> => ipcRenderer.invoke('yc:get-palette-actions'),
  getCacheStatus: (): Promise<unknown> => ipcRenderer.invoke('yc:get-cache-status'),
  clearCache: (): Promise<unknown> => ipcRenderer.invoke('yc:clear-cache'),
  getCachedUrls: (): Promise<unknown> => ipcRenderer.invoke('yc:get-cached-urls'),
  getSyncStatus: (): Promise<unknown> => ipcRenderer.invoke('yc:get-sync-status'),
  syncNow: (): Promise<unknown> => ipcRenderer.invoke('yc:sync-now'),
  clearLocalData: (): Promise<unknown> => ipcRenderer.invoke('yc:clear-local-data'),
  showNotification: (opts: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:show-notification', opts),
  authenticateBiometric: (reason?: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:authenticate-biometric', reason),
  applyTheme: (): Promise<unknown> => ipcRenderer.invoke('yc:apply-theme'),
  onShortcut: (callback: (id: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string): void => callback(id);
    ipcRenderer.on('yc:shortcut', handler);
    return () => ipcRenderer.removeListener('yc:shortcut', handler);
  },
  openPatientWindow: (patientId: string, name: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:open-patient-window', patientId, name),
  csRecord: (data: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:cs-record', data),
  csExport: (date?: string): Promise<unknown> => ipcRenderer.invoke('yc:cs-export', date),
  auditAppend: (entry: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:audit-append', entry),
  vaultSave: (filename: string, content: string, mimeType?: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:vault-save', filename, content, mimeType),
  vaultList: (): Promise<unknown> => ipcRenderer.invoke('yc:vault-list'),
  vaultGet: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:vault-get', id),
  vaultDelete: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:vault-delete', id),
  vaultStats: (): Promise<unknown> => ipcRenderer.invoke('yc:vault-stats'),
  vaultSaveBuffer: (filename: string, base64Content: string, mimeType: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:vault-save-buffer', filename, base64Content, mimeType),
  vaultExport: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:vault-export', id),
  vaultRevealDoc: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:vault-reveal-doc', id),
  vaultOpen: (): Promise<unknown> => ipcRenderer.invoke('yc:vault-open'),
  deaRegister: (reg: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('yc:dea-register', reg),
  getCachedContent: (url: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:get-cached-content', url),
  getTabs: (): Promise<unknown> => ipcRenderer.invoke('yc:tabs-get'),
  newTab: (url?: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-new', url),
  closeTab: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-close', id),
  activateTab: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-activate', id),
  moveTab: (id: string, toIndex: number): Promise<unknown> =>
    ipcRenderer.invoke('yc:tab-move', id, toIndex),
  pinTab: (id: string, pinned: boolean): Promise<unknown> =>
    ipcRenderer.invoke('yc:tab-pin', id, pinned),
  duplicateTab: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-duplicate', id),
  reopenClosedTab: (): Promise<unknown> => ipcRenderer.invoke('yc:tab-reopen-closed'),
  setTabZoom: (id: string, level: number): Promise<unknown> =>
    ipcRenderer.invoke('yc:tab-set-zoom', id, level),
  tabSearch: (open: boolean): Promise<unknown> => ipcRenderer.invoke('yc:tab-search', open),
  findInPage: (text: string, forward?: boolean, matchCase?: boolean): Promise<unknown> =>
    ipcRenderer.invoke('yc:find-in-page', { text, forward, matchCase }),
  stopFindInPage: (): Promise<unknown> => ipcRenderer.invoke('yc:stop-find-in-page'),
  openDevTools: (): Promise<unknown> => ipcRenderer.invoke('yc:open-devtools'),
  closeDevTools: (): Promise<unknown> => ipcRenderer.invoke('yc:close-devtools'),
  toggleTabMute: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-toggle-mute', id),
  getTabPreview: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-get-preview', id),
  detachTab: (id: string): Promise<unknown> => ipcRenderer.invoke('yc:tab-detach', id),
  setTabOrientation: (mode: 'horizontal' | 'vertical'): Promise<unknown> =>
    ipcRenderer.invoke('yc:tab-set-orientation', mode),
  setSplitTab: (id: string | null): Promise<unknown> => ipcRenderer.invoke('yc:tab-set-split', id),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('yc:get-app-version'),
  getLastSeenVersion: (): Promise<string> => ipcRenderer.invoke('yc:get-last-seen-version'),
  setLastSeenVersion: (v: string): Promise<unknown> =>
    ipcRenderer.invoke('yc:set-last-seen-version', v),
  dismissWhatsNew: (): Promise<unknown> => ipcRenderer.invoke('yc:dismiss-whats-new'),
  windowDragBy: (dx: number, dy: number): void => ipcRenderer.send('yc:window-drag-by', dx, dy),
};

contextBridge.exposeInMainWorld('ycDesktop', api);
