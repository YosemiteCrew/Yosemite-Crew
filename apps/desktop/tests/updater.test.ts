import {
  DISABLE_ENV,
  UPDATE_CHANNEL_ENV,
  configureUpdateChannel,
  shouldCheckForUpdates,
  updateChannelFromEnv,
  updateDownloadedDialog,
  manualResultDialog,
  initAutoUpdates,
  checkForUpdatesManually,
  autoUpdaterFromModule,
} from '../src/lifecycle/updater';

interface FakeUpdater {
  autoDownload?: boolean;
  autoInstallOnAppQuit?: boolean;
  allowPrerelease?: boolean;
  channel?: string;
  calls: string[];
  handlers: Record<string, (info?: unknown) => void>;
  on: (event: string, fn: (info?: unknown) => void) => void;
  once: (event: string, fn: (info?: unknown) => void) => void;
  checkForUpdatesAndNotify: () => Promise<unknown>;
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: () => void;
}

const makeFakeUpdater = (): FakeUpdater => {
  const handlers: Record<string, (info?: unknown) => void> = {};
  return {
    autoDownload: undefined,
    autoInstallOnAppQuit: undefined,
    calls: [],
    handlers,
    on(event, fn) {
      handlers[event] = fn;
    },
    once(event, fn) {
      handlers[event] = fn;
    },
    checkForUpdatesAndNotify() {
      this.calls.push('checkAndNotify');
      return Promise.resolve();
    },
    checkForUpdates() {
      this.calls.push('check');
      return Promise.resolve();
    },
    quitAndInstall() {
      this.calls.push('quitAndInstall');
    },
  };
};

describe('pure helpers', () => {
  test('only checks for updates in a packaged build, unless disabled', () => {
    expect(shouldCheckForUpdates(true, {})).toBe(true);
    expect(shouldCheckForUpdates(false, {})).toBe(false);
    expect(shouldCheckForUpdates(true, { [DISABLE_ENV]: '1' })).toBe(false);
  });

  test('selects latest update channel by default and beta only when requested', () => {
    expect(updateChannelFromEnv({})).toBe('latest');
    expect(updateChannelFromEnv({ [UPDATE_CHANNEL_ENV]: 'latest' })).toBe('latest');
    expect(updateChannelFromEnv({ [UPDATE_CHANNEL_ENV]: 'stable' })).toBe('latest');
    expect(updateChannelFromEnv({ [UPDATE_CHANNEL_ENV]: 'BETA' })).toBe('beta');
  });

  test('configures the updater channel and prerelease flag', () => {
    const latestUpdater: { channel?: string; allowPrerelease?: boolean } = {};
    expect(configureUpdateChannel(latestUpdater, {})).toBe('latest');
    expect(latestUpdater).toEqual({
      channel: 'latest',
      allowPrerelease: false,
    });

    const betaUpdater: { channel?: string; allowPrerelease?: boolean } = {};
    expect(configureUpdateChannel(betaUpdater, { [UPDATE_CHANNEL_ENV]: 'beta' })).toBe('beta');
    expect(betaUpdater).toEqual({ channel: 'beta', allowPrerelease: true });
  });

  test('honors an explicit preferred channel over env', () => {
    const updater: { channel?: string; allowPrerelease?: boolean } = {};
    // env says beta, but the persisted preference (latest) wins.
    expect(configureUpdateChannel(updater, { [UPDATE_CHANNEL_ENV]: 'beta' }, 'latest')).toBe(
      'latest'
    );
    expect(updater).toEqual({ channel: 'latest', allowPrerelease: false });

    const betaUpdater: { channel?: string; allowPrerelease?: boolean } = {};
    expect(configureUpdateChannel(betaUpdater, {}, 'beta')).toBe('beta');
    expect(betaUpdater).toEqual({ channel: 'beta', allowPrerelease: true });
  });

  test('accepts both named and default electron-updater exports', () => {
    const named = makeFakeUpdater();
    const nested = makeFakeUpdater();

    expect(autoUpdaterFromModule({ autoUpdater: named as never })).toBe(named);
    expect(autoUpdaterFromModule({ default: { autoUpdater: nested as never } })).toBe(nested);
    expect(autoUpdaterFromModule({})).toBeNull();
  });

  test('update-downloaded dialog includes version and restart action', () => {
    const dialog = updateDownloadedDialog({ version: '1.2.3' });
    expect(dialog.message).toMatch(/1\.2\.3/);
    expect(dialog.buttons).toEqual(['Restart Now', 'Later']);
    expect(dialog.defaultId).toBe(0);
  });

  test('update-downloaded dialog omits version when unknown', () => {
    expect(updateDownloadedDialog({}).message).not.toMatch(/\(/);
    expect(updateDownloadedDialog(undefined).message).toContain('is ready');
  });

  test('manual result dialog varies by state', () => {
    expect(manualResultDialog('none', { version: '1.0.0' }).message).toMatch(/up to date/i);
    expect(manualResultDialog('none', {}).detail).toBeUndefined();
    expect(manualResultDialog('available').message).toMatch(/available/i);
    expect(manualResultDialog('error').type).toBe('error');
  });
});

describe('initAutoUpdates', () => {
  test('is a no-op in dev (not packaged)', async () => {
    const result = await initAutoUpdates({
      electron: {
        app: { isPackaged: false },
        dialog: { showMessageBox: () => undefined },
      },
      env: {},
    });
    expect(result).toBeNull();
  });

  test('wires events and triggers a background check when packaged', async () => {
    const updater = makeFakeUpdater();
    const result = await initAutoUpdates({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => Promise.resolve({ response: 1 }) },
      },
      autoUpdater: updater as never,
      env: {},
    });
    expect(result).toBe(updater);
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(updater.channel).toBe('latest');
    expect(updater.allowPrerelease).toBe(false);
    expect(typeof updater.handlers['update-downloaded']).toBe('function');
    expect(typeof updater.handlers.error).toBe('function');
    expect(updater.calls).toContain('checkAndNotify');
  });

  test('applies the beta update channel during startup checks', async () => {
    const updater = makeFakeUpdater();
    await initAutoUpdates({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => Promise.resolve({ response: 1 }) },
      },
      autoUpdater: updater as never,
      env: { [UPDATE_CHANNEL_ENV]: 'beta' },
    });
    expect(updater.channel).toBe('beta');
    expect(updater.allowPrerelease).toBe(true);
  });

  test('restart prompt installs the update when the user accepts', async () => {
    const updater = makeFakeUpdater();
    let resolveBox: (value: { response: number }) => void = () => {};
    const dialog = {
      showMessageBox: () =>
        new Promise<{ response: number }>((r) => {
          resolveBox = r;
        }),
    };
    await initAutoUpdates({
      electron: { app: { isPackaged: true }, dialog },
      autoUpdater: updater as never,
      env: {},
    });
    updater.handlers['update-downloaded']({ version: '2.0.0' });
    resolveBox({ response: 0 });
    await Promise.resolve();
    await Promise.resolve();
    expect(updater.calls).toContain('quitAndInstall');
  });

  test('restart prompt does not install when the user defers', async () => {
    const updater = makeFakeUpdater();
    const dialog = { showMessageBox: () => Promise.resolve({ response: 1 }) };
    await initAutoUpdates({
      electron: { app: { isPackaged: true }, dialog },
      autoUpdater: updater as never,
      env: {},
    });
    updater.handlers['update-downloaded']({ version: '2.0.0' });
    await Promise.resolve();
    await Promise.resolve();
    expect(updater.calls).not.toContain('quitAndInstall');
  });

  test('logs restart prompt failures without throwing', async () => {
    const updater = makeFakeUpdater();
    const warn = jest.fn();
    const logger = { info: jest.fn(), warn, error: jest.fn() };
    const dialog = {
      showMessageBox: () => Promise.reject(new Error('dialog failed')),
    };
    await initAutoUpdates({
      electron: { app: { isPackaged: true }, dialog },
      autoUpdater: updater as never,
      env: {},
      logger,
    });

    updater.handlers['update-downloaded']({ version: '2.0.0' });
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith(
      'update_restart_prompt_failed',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  test('uses injected dependencies when provided', async () => {
    const updater = makeFakeUpdater();
    const result = await initAutoUpdates({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => Promise.resolve({ response: 1 }) },
      },
      autoUpdater: updater as never,
      env: {},
    });

    expect(result).toBe(updater);
    expect(updater.calls).toContain('checkAndNotify');
  });
});

describe('checkForUpdatesManually', () => {
  test('explains that updates need the packaged app in dev', async () => {
    const messages: Array<{ message: string }> = [];
    const result = await checkForUpdatesManually({
      electron: {
        app: { isPackaged: false },
        dialog: { showMessageBox: (o) => messages.push(o) },
      },
    });
    expect(result).toBeNull();
    expect(messages[0].message).toMatch(/installed app/i);
  });

  test('registers feedback handlers and checks when packaged', async () => {
    const updater = makeFakeUpdater();
    await checkForUpdatesManually({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => undefined },
      },
      autoUpdater: updater as never,
    });
    expect(typeof updater.handlers['update-not-available']).toBe('function');
    expect(typeof updater.handlers['update-available']).toBe('function');
    expect(typeof updater.handlers.error).toBe('function');
    expect(updater.channel).toBe('latest');
    expect(updater.allowPrerelease).toBe(false);
    expect(updater.calls).toContain('check');
  });

  test('applies the beta update channel during manual checks', async () => {
    const updater = makeFakeUpdater();
    await checkForUpdatesManually({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => undefined },
      },
      autoUpdater: updater as never,
      env: { [UPDATE_CHANNEL_ENV]: 'beta' },
    });
    expect(updater.channel).toBe('beta');
    expect(updater.allowPrerelease).toBe(true);
  });

  test('each registered handler shows the matching dialog', async () => {
    const updater = makeFakeUpdater();
    const messages: Array<{ type?: string; message: string }> = [];
    await checkForUpdatesManually({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: (o) => messages.push(o) },
      },
      autoUpdater: updater as never,
    });
    updater.handlers['update-not-available']({ version: '1.0.0' });
    updater.handlers['update-available']({ version: '2.0.0' });
    updater.handlers.error(new Error('offline'));
    expect(messages.map((m) => m.type)).toEqual(['info', 'info', 'error']);
    expect(messages[0].message).toMatch(/up to date/i);
  });

  test('the background error handler is a safe no-op', async () => {
    const updater = makeFakeUpdater();
    await initAutoUpdates({
      electron: {
        app: { isPackaged: true },
        dialog: { showMessageBox: () => Promise.resolve({ response: 1 }) },
      },
      autoUpdater: updater as never,
      env: {},
    });
    expect(() => updater.handlers.error(new Error('background'))).not.toThrow();
  });
});
