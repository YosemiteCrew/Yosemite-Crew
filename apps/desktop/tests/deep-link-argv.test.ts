jest.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: () => true,
    setName() {},
    setAppUserModelId() {},
    setAsDefaultProtocolClient() {},
    setAboutPanelOptions() {},
    on() {},
    whenReady: () => ({ then: () => ({}) }),
    getPath: () => '/tmp/yc-desktop-test',
    getVersion: () => '0.1.0',
    name: 'Yosemite Crew PIMS',
    quit() {},
  },
  BrowserWindow: class {
    static getAllWindows() {
      return [];
    }
  },
  Menu: { setApplicationMenu() {}, buildFromTemplate: () => ({}) },
  MenuItem: class {
    constructor(options: Record<string, unknown>) {
      Object.assign(this, options);
    }
  },
  Notification: class {
    static isSupported() {
      return false;
    }
  },
  dialog: {
    showErrorBox() {},
    showMessageBox: () => Promise.resolve({ response: 1 }),
  },
  shell: { openExternal: async () => undefined, showItemInFolder() {} },
  ipcMain: { handle() {} },
  clipboard: { writeText() {} },
  crashReporter: { start() {} },
  protocol: { registerSchemesAsPrivileged() {}, handle() {} },
}));

import { deepLinkFromArgv } from '../src/shell/window-config';

describe('deepLinkFromArgv', () => {
  test('extracts a Windows/Linux protocol URL from process argv', () => {
    expect(
      deepLinkFromArgv(['/opt/Yosemite Crew PIMS', '--flag', 'yosemitecrew://appointments/123'])
    ).toBe('yosemitecrew://appointments/123');
  });

  test('ignores non-yosemitecrew argv entries', () => {
    expect(
      deepLinkFromArgv(['/opt/Yosemite Crew PIMS', 'https://yosemitecrew.com/signin'])
    ).toBeNull();
    expect(deepLinkFromArgv([])).toBeNull();
  });
});
