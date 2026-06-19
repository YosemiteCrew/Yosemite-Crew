// Records of side-effects performed through the mocked Electron shell module.
const mockOpened: string[] = [];

jest.mock('electron', () => {
  class FakeMenu {
    _items: Array<Record<string, unknown>> = [];
    append(item: Record<string, unknown>) {
      this._items.push(item);
    }
    get items() {
      return this._items;
    }
    popup() {}
    static setApplicationMenu() {}
    static buildFromTemplate() {
      return new FakeMenu();
    }
  }

  return {
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
      static getFocusedWindow() {
        return null;
      }
    },
    Menu: FakeMenu,
    MenuItem: class {
      constructor(options: Record<string, unknown>) {
        Object.assign(this, options);
      }
    },
    Notification: class {
      static isSupported() {
        return false;
      }
      show() {}
    },
    dialog: {
      showErrorBox() {},
      showMessageBox: () => Promise.resolve({ response: 1 }),
    },
    shell: {
      openExternal: async (url: string) => {
        mockOpened.push(url);
      },
      showItemInFolder() {},
    },
    ipcMain: { handle() {} },
    clipboard: { writeText() {} },
    crashReporter: { start() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
  };
});

import {
  handleWindowOpen,
  handleMainNavigation,
  buildContextMenu,
  childWindowOptions,
  deepLinkFromArgv,
} from '../src/shell/window-config';

beforeEach(() => {
  mockOpened.length = 0;
});

describe('handleWindowOpen', () => {
  test('opens PIMS popups in a secure in-app window', () => {
    const result = handleWindowOpen('https://yosemitecrew.com/appointments/123/print');
    expect(result.action).toBe('allow');
    expect(result.overrideBrowserWindowOptions?.webPreferences?.contextIsolation).toBe(true);
    expect(mockOpened).toHaveLength(0);
  });

  test('opens configured document/asset URLs in-app, not the browser', () => {
    const result = handleWindowOpen('https://cdn.yc.dev/lab-result.pdf?sig=abc');
    expect(result.action).toBe('allow');
    expect(mockOpened).toHaveLength(0);
  });

  test('sends untrusted external popup origins to the system browser', () => {
    const result = handleWindowOpen('https://example.com/phish');
    expect(result.action).toBe('deny');
    expect(mockOpened).toHaveLength(1);
  });

  test('sends developer portal popups to the system browser', () => {
    const result = handleWindowOpen('https://yosemitecrew.com/developers/home');
    expect(result.action).toBe('deny');
    expect(mockOpened).toHaveLength(1);
  });

  test('sends mailto links to the system browser', () => {
    const result = handleWindowOpen('mailto:vet@example.com');
    expect(result.action).toBe('deny');
    expect(mockOpened).toHaveLength(1);
  });

  test('denies unsupported-protocol popups without opening anything', () => {
    const result = handleWindowOpen('file:///etc/passwd');
    expect(result.action).toBe('deny');
    expect(mockOpened).toHaveLength(0);
  });
});

describe('handleMainNavigation', () => {
  test('keeps same-origin navigation inside the main window', () => {
    let prevented = false;
    handleMainNavigation(
      {
        preventDefault: () => {
          prevented = true;
        },
      },
      'https://yosemitecrew.com/dashboard'
    );
    expect(prevented).toBe(false);
    expect(mockOpened).toHaveLength(0);
  });

  test('redirects external main-window navigation to the system browser', () => {
    let prevented = false;
    handleMainNavigation(
      {
        preventDefault: () => {
          prevented = true;
        },
      },
      'https://example.com/landing'
    );
    expect(prevented).toBe(true);
    expect(mockOpened).toHaveLength(1);
  });
});

describe('childWindowOptions', () => {
  test('enforce a sandboxed, isolated context', () => {
    const options = childWindowOptions();
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.contextIsolation).toBe(true);
  });
});

describe('deepLinkFromArgv', () => {
  test('finds the yosemitecrew:// argument', () => {
    expect(deepLinkFromArgv(['/path/to/app', '--flag', 'yosemitecrew://appointments/9'])).toBe(
      'yosemitecrew://appointments/9'
    );
    expect(deepLinkFromArgv(['/path/to/app', '--flag'])).toBeNull();
    expect(deepLinkFromArgv([])).toBeNull();
  });
});

describe('buildContextMenu', () => {
  test('offers paste and spellcheck suggestions in editable fields', () => {
    const menu = buildContextMenu(
      {
        editFlags: {
          canUndo: true,
          canRedo: false,
          canCut: true,
          canCopy: true,
          canPaste: true,
        },
        isEditable: true,
        selectionText: 'patient',
        dictionarySuggestions: ['patient'],
      },
      { replaceMisspelling() {} }
    );
    const roles = (menu?.items ?? []).map((item) => item.role).filter(Boolean);
    expect(roles).toContain('paste');
    expect(roles).toContain('copy');
  });

  test('offers Copy/Open-in-Browser for a plain link selection', () => {
    const menu = buildContextMenu(
      {
        editFlags: {},
        isEditable: false,
        selectionText: 'click here',
        linkURL: 'https://example.com',
      },
      {}
    );
    const labels = (menu?.items ?? []).map((item) => item.label).filter(Boolean);
    expect(labels).toContain('Open Link in Browser');
    expect(labels).toContain('Copy Link');
  });
});
