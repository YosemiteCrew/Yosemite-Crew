'use strict';

import {
  clipboard,
  dialog,
  Menu,
  MenuItem,
  shell,
  type Session,
  type WebContents,
  type WindowOpenHandlerResponse,
} from 'electron';
import {
  classifyNavigation,
  isAllowedInAppPopup,
  getDesktopConfig,
} from '../core/navigation-policy';
import { createLogger, type DesktopLogger } from '../utils/logger';

// Read the desktop config lazily (and memoize). main.ts applies managed/MDM env
// during startup, which runs before any of these handlers fire — reading at
// import time would snapshot the config before that env is applied.
let _config: ReturnType<typeof getDesktopConfig> | null = null;
const getConfig = (): ReturnType<typeof getDesktopConfig> => (_config ??= getDesktopConfig());
const _logger: DesktopLogger = createLogger();

export const DEEP_LINK_SCHEME = 'yosemitecrew';

const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

export const permittedPermissions = new Set([
  'clipboard-read',
  'display-capture',
  'geolocation',
  'media',
  'notifications',
]);

type PermissionDetails =
  | Electron.PermissionRequest
  | Electron.FilesystemPermissionRequest
  | Electron.MediaAccessPermissionRequest
  | Electron.OpenExternalPermissionRequest;

export interface ContextMenuParams {
  editFlags?: {
    canUndo?: boolean;
    canRedo?: boolean;
    canCut?: boolean;
    canCopy?: boolean;
    canPaste?: boolean;
  };
  isEditable?: boolean;
  selectionText?: string;
  linkURL?: string;
  mediaType?: string;
  dictionarySuggestions?: string[];
  x?: number;
  y?: number;
}

export interface ContextMenuWebContents {
  replaceMisspelling?: (suggestion: string) => void;
  copyImageAt?: (x: number, y: number) => void;
}

export const openExternal = async (url: URL | string | undefined): Promise<void> => {
  if (!url) return;
  const href = url instanceof URL ? url.href : String(url);
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    _logger.warn('external_link_invalid_url', { href });
    return;
  }
  if (!ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol)) {
    _logger.warn('external_link_blocked_scheme', {
      href,
      scheme: parsed.protocol,
    });
    return;
  }
  try {
    await shell.openExternal(href);
    _logger.info('external_link_opened', { href });
  } catch (error) {
    _logger.error('external_link_failed', { href, error });
    dialog.showErrorBox('Unable to open link', href);
  }
};

export const secureWebPreferences = (
  preload?: string
): Electron.BrowserWindowConstructorOptions['webPreferences'] => ({
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  webviewTag: false,
  partition: getConfig().appPartition,
  ...(preload ? { preload } : {}),
});

export const childWindowOptions = (): Electron.BrowserWindowConstructorOptions => ({
  width: 1200,
  height: 860,
  backgroundColor: '#ffffff',
  autoHideMenuBar: process.platform !== 'darwin',
  webPreferences: secureWebPreferences(),
});

export const handleWindowOpen = (rawUrl: string): WindowOpenHandlerResponse => {
  const decision = classifyNavigation(rawUrl, getConfig());

  if (decision.disposition === 'internal' || isAllowedInAppPopup(rawUrl, getConfig())) {
    _logger.info('popup_allowed_in_app', { url: decision.url?.href || rawUrl });
    return {
      action: 'allow',
      overrideBrowserWindowOptions: childWindowOptions(),
    };
  }

  if (decision.disposition === 'external') {
    _logger.info('popup_opened_external', {
      reason: decision.reason,
      url: decision.url?.href,
    });
    void openExternal(decision.url);
  } else {
    _logger.warn('popup_blocked', {
      reason: decision.reason,
      url: decision.url?.href || rawUrl,
    });
  }

  return { action: 'deny' };
};

export const handleMainNavigation = (
  event: Pick<Event, 'preventDefault'>,
  rawUrl: string
): void => {
  const decision = classifyNavigation(rawUrl, getConfig());
  if (decision.disposition === 'internal') return;

  event.preventDefault();
  _logger.info('main_navigation_intercepted', {
    reason: decision.reason,
    url: decision.url?.href || rawUrl,
  });
  if (decision.disposition === 'external') {
    void openExternal(decision.url);
  }
};

export const shouldGrantPermission = (
  permission: string,
  details: PermissionDetails,
  webContents: WebContents
): boolean => {
  const requestingUrl = details.requestingUrl || webContents.getURL();
  const decision = classifyNavigation(requestingUrl, getConfig());
  return decision.disposition === 'internal' && permittedPermissions.has(permission);
};

export const configureSessionPermissions = (ses: Session): void => {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const granted = shouldGrantPermission(permission, details, webContents);
    _logger.info('permission_request', {
      permission,
      granted,
      requestingUrl: details.requestingUrl || webContents.getURL(),
    });
    callback(granted);
  });

  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const decision = classifyNavigation(requestingOrigin || '', getConfig());
    return decision.disposition === 'internal' && permittedPermissions.has(permission);
  });
};

export const getCacheStrategy = (url: string): 'cache-first' | 'network-first' => {
  const pathname = new URL(url).pathname;
  if (pathname.startsWith('/_next/static/')) return 'cache-first';
  if (pathname.startsWith('/static/')) return 'cache-first';
  if (pathname.startsWith('/assets/')) return 'cache-first';
  if (pathname.startsWith('/fonts/')) return 'cache-first';
  return 'network-first';
};

export const buildContextMenu = (
  params: ContextMenuParams,
  webContents: ContextMenuWebContents
): Electron.Menu | null => {
  const menu = new Menu();
  const {
    editFlags = {},
    isEditable = false,
    selectionText = '',
    linkURL,
    mediaType,
    dictionarySuggestions = [],
  } = params;

  if (isEditable && dictionarySuggestions.length > 0 && webContents.replaceMisspelling) {
    dictionarySuggestions.forEach((suggestion) => {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => webContents.replaceMisspelling?.(suggestion),
        })
      );
    });
    menu.append(new MenuItem({ type: 'separator' }));
  }

  if (linkURL) {
    menu.append(
      new MenuItem({
        label: 'Open Link in Browser',
        click: () => void openExternal(linkURL),
      })
    );
    menu.append(
      new MenuItem({
        label: 'Copy Link',
        click: () => clipboard.writeText(linkURL),
      })
    );
    menu.append(new MenuItem({ type: 'separator' }));
  }

  if (mediaType === 'image' && webContents.copyImageAt) {
    menu.append(
      new MenuItem({
        label: 'Copy Image',
        click: () => webContents.copyImageAt?.(params.x || 0, params.y || 0),
      })
    );
    menu.append(new MenuItem({ type: 'separator' }));
  }

  if (isEditable) {
    menu.append(new MenuItem({ role: 'undo', enabled: editFlags.canUndo }));
    menu.append(new MenuItem({ role: 'redo', enabled: editFlags.canRedo }));
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ role: 'cut', enabled: editFlags.canCut }));
  }

  menu.append(
    new MenuItem({
      role: 'copy',
      enabled: editFlags.canCopy || Boolean(selectionText),
    })
  );

  if (isEditable) {
    menu.append(new MenuItem({ role: 'paste', enabled: editFlags.canPaste }));
    menu.append(new MenuItem({ role: 'selectAll' }));
  }

  return menu.items.length > 0 ? menu : null;
};

export const deepLinkFromArgv = (argv: readonly string[] = []): string | null =>
  argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${DEEP_LINK_SCHEME}://`)) || null;
