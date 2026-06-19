'use strict';

// Auto-update wiring for the packaged app, reading releases from GitHub
// (configured via electron-builder `publish`). Electron and electron-updater are
// required lazily so this module can be unit tested and loaded in dev without
// pulling the native updater.

const PRODUCT_NAME = 'Yosemite Crew PIMS';
export const DISABLE_ENV = 'YC_DESKTOP_DISABLE_UPDATES';
export const UPDATE_CHANNEL_ENV = 'YC_DESKTOP_UPDATE_CHANNEL';
export type UpdateChannel = 'latest' | 'beta';

interface UpdateInfo {
  version?: string;
}

interface MessageBoxOptions {
  type?: string;
  buttons?: string[];
  defaultId?: number;
  cancelId?: number;
  message: string;
  detail?: string;
}

interface AutoUpdaterLike {
  autoDownload?: boolean;
  autoInstallOnAppQuit?: boolean;
  allowPrerelease?: boolean;
  channel?: string;
  on: (event: string, handler: (info?: UpdateInfo) => void) => void;
  once: (event: string, handler: (info?: UpdateInfo) => void) => void;
  checkForUpdatesAndNotify: () => Promise<unknown>;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
}

interface ElectronLike {
  app: { isPackaged: boolean };
  dialog: {
    showMessageBox: (options: MessageBoxOptions) => Promise<{ response: number }> | void;
  };
}

type ElectronUpdaterModule = {
  autoUpdater?: AutoUpdaterLike;
  default?: {
    autoUpdater?: AutoUpdaterLike;
  };
};

export interface UpdaterDeps {
  electron?: ElectronLike;
  autoUpdater?: AutoUpdaterLike;
  env?: NodeJS.ProcessEnv;
  preferredChannel?: UpdateChannel;
  logger?: {
    info: (event: string, data?: unknown) => void;
    warn: (event: string, data?: unknown) => void;
    error: (event: string, data?: unknown) => void;
  };
}

// Pure: updates only run in a packaged build and unless explicitly disabled.
export const shouldCheckForUpdates = (
  isPackaged: boolean,
  env: NodeJS.ProcessEnv = process.env
): boolean => Boolean(isPackaged) && env[DISABLE_ENV] !== '1';

export const updateChannelFromEnv = (env: NodeJS.ProcessEnv = process.env): UpdateChannel => {
  const raw = env[UPDATE_CHANNEL_ENV];
  return raw?.toLowerCase() === 'beta' ? 'beta' : 'latest';
};

export const configureUpdateChannel = (
  autoUpdater: Pick<AutoUpdaterLike, 'allowPrerelease' | 'channel'>,
  env: NodeJS.ProcessEnv = process.env,
  preferred?: UpdateChannel
): UpdateChannel => {
  const channel = preferred ?? updateChannelFromEnv(env);
  autoUpdater.channel = channel;
  autoUpdater.allowPrerelease = channel === 'beta';
  return channel;
};

export const autoUpdaterFromModule = (mod: ElectronUpdaterModule): AutoUpdaterLike | null =>
  mod.autoUpdater ?? mod.default?.autoUpdater ?? null;

// Pure: dialog shown once an update has been downloaded and is ready to install.
export const updateDownloadedDialog = (info?: UpdateInfo): MessageBoxOptions => {
  const version = info?.version ? ` (${info.version})` : '';
  return {
    type: 'info',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: `A new version of ${PRODUCT_NAME}${version} is ready.`,
    detail: 'Restart the app to finish updating. Your session stays signed in.',
  };
};

// Pure: feedback dialog for a manual "Check for Updates" when none is found / on error.
export const manualResultDialog = (
  state: 'none' | 'available' | 'error',
  info?: UpdateInfo
): MessageBoxOptions => {
  if (state === 'none') {
    return {
      type: 'info',
      buttons: ['OK'],
      message: `${PRODUCT_NAME} is up to date.`,
      detail: info?.version ? `You're on the latest version (${info.version}).` : undefined,
    };
  }
  if (state === 'available') {
    return {
      type: 'info',
      buttons: ['OK'],
      message: 'An update is available.',
      detail:
        'It will download in the background and you’ll be prompted to restart when it’s ready.',
    };
  }
  return {
    type: 'error',
    buttons: ['OK'],
    message: 'Could not check for updates.',
    detail: 'Please check your internet connection and try again later.',
  };
};

const resolveAutoUpdater = async (deps: UpdaterDeps): Promise<AutoUpdaterLike> => {
  if (deps.autoUpdater) return deps.autoUpdater;
  const mod = (await import('electron-updater')) as ElectronUpdaterModule;
  const updater = autoUpdaterFromModule(mod);
  if (!updater) {
    throw new Error('electron-updater autoUpdater export was not found');
  }
  return updater;
};

const resolveElectron = async (deps: UpdaterDeps): Promise<ElectronLike> => {
  if (deps.electron) return deps.electron;
  const mod = await import('electron');
  return mod as unknown as ElectronLike;
};

// Background check on startup (packaged only). Prompts to restart when downloaded.
export const initAutoUpdates = async (deps: UpdaterDeps = {}): Promise<AutoUpdaterLike | null> => {
  const { app, dialog } = await resolveElectron(deps);
  if (!shouldCheckForUpdates(app.isPackaged, deps.env || process.env)) return null;

  let autoUpdater: AutoUpdaterLike;
  try {
    autoUpdater = await resolveAutoUpdater(deps);
    configureUpdateChannel(autoUpdater, deps.env || process.env, deps.preferredChannel);
  } catch (error) {
    deps.logger?.warn('update_setup_unavailable', { error });
    return null;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', (info?: UpdateInfo) => {
    deps.logger?.info('update_downloaded', info);
    const result = dialog.showMessageBox(updateDownloadedDialog(info));
    if (result && typeof (result as Promise<{ response: number }>).then === 'function') {
      void (result as Promise<{ response: number }>)
        .then((res) => {
          if (res.response === 0) autoUpdater.quitAndInstall();
        })
        .catch((error) => deps.logger?.warn('update_restart_prompt_failed', { error }));
    }
  });
  // Stay quiet on background errors; the manual check surfaces problems instead.
  autoUpdater.on('error', (error?: UpdateInfo) => {
    deps.logger?.warn('update_background_error', error);
  });

  void autoUpdater
    .checkForUpdatesAndNotify()
    .catch((error) => deps.logger?.warn('update_check_failed', { error }));
  return autoUpdater;
};

// Manual "Check for Updates…" menu action with explicit user feedback.
export const checkForUpdatesManually = async (
  deps: UpdaterDeps = {}
): Promise<AutoUpdaterLike | null> => {
  const { app, dialog } = await resolveElectron(deps);
  if (!app.isPackaged) {
    void dialog.showMessageBox({
      type: 'info',
      buttons: ['OK'],
      message: 'Updates are only available in the installed app.',
      detail: 'Run the packaged Yosemite Crew PIMS app to receive updates.',
    });
    return null;
  }

  let autoUpdater: AutoUpdaterLike;
  try {
    autoUpdater = await resolveAutoUpdater(deps);
    configureUpdateChannel(autoUpdater, deps.env || process.env, deps.preferredChannel);
  } catch (error) {
    deps.logger?.warn('manual_update_setup_unavailable', { error });
    void dialog.showMessageBox(manualResultDialog('error'));
    return null;
  }
  autoUpdater.once(
    'update-not-available',
    (info?: UpdateInfo) => void dialog.showMessageBox(manualResultDialog('none', info))
  );
  autoUpdater.once(
    'update-available',
    (info?: UpdateInfo) => void dialog.showMessageBox(manualResultDialog('available', info))
  );
  autoUpdater.once('error', (error?: UpdateInfo) => {
    deps.logger?.warn('manual_update_check_failed', error);
    void dialog.showMessageBox(manualResultDialog('error'));
  });

  void autoUpdater
    .checkForUpdates()
    .catch((error) => deps.logger?.warn('manual_update_check_rejected', { error }));
  return autoUpdater;
};
