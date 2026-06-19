import type { YcDesktop } from '../src/preload';

interface Invocation {
  channel: string;
  args: unknown[];
}

const mockExposed: Record<string, YcDesktop> = {};
const mockInvoked: Invocation[] = [];
const mockSent: Invocation[] = [];
const mockListeners: Record<string, (event: unknown, ...args: unknown[]) => void> = {};

jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: YcDesktop) => {
      mockExposed[key] = api;
    },
  },
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      mockInvoked.push({ channel, args });
      return Promise.resolve({ ok: true });
    },
    send: (channel: string, ...args: unknown[]) => {
      mockSent.push({ channel, args });
    },
    on: (channel: string, handler: (event: unknown, ...args: unknown[]) => void) => {
      mockListeners[channel] = handler;
    },
    removeListener: (channel: string) => {
      delete mockListeners[channel];
    },
  },
}));

import '../src/preload';

describe('preload bridge', () => {
  beforeEach(() => {
    mockInvoked.length = 0;
  });

  test('exposes a ycDesktop API', () => {
    expect(typeof mockExposed.ycDesktop).toBe('object');
  });

  test('contextBridge.exposeInMainWorld was called with ycDesktop', () => {
    expect(mockExposed.ycDesktop).toBeDefined();
  });

  describe('methods invoke correct IPC channels', () => {
    type TestCase = {
      name: keyof YcDesktop;
      channel: string;
      args?: unknown[];
    };
    const cases: TestCase[] = [
      { name: 'reload', channel: 'yc:reload' },
      { name: 'openInBrowser', channel: 'yc:open-in-browser' },
      { name: 'startSignin', channel: 'yc:start-signin' },
      {
        name: 'startTelehealth',
        channel: 'yc:start-telehealth',
        args: [{ appointmentId: 'appt-123' }],
      },
      { name: 'getSettings', channel: 'yc:get-settings' },
      {
        name: 'setSettings',
        channel: 'yc:set-settings',
        args: [{ theme: 'dark' }],
      },
      {
        name: 'executeCommand',
        channel: 'yc:execute-command',
        args: ['cmd-palette-1'],
      },
      { name: 'getPaletteRecents', channel: 'yc:get-palette-recents' },
      { name: 'getPaletteActions', channel: 'yc:get-palette-actions' },
      { name: 'closePalette', channel: 'yc:close-palette' },
      { name: 'getCacheStatus', channel: 'yc:get-cache-status' },
      { name: 'clearCache', channel: 'yc:clear-cache' },
      { name: 'getCachedUrls', channel: 'yc:get-cached-urls' },
      { name: 'getSyncStatus', channel: 'yc:get-sync-status' },
      { name: 'syncNow', channel: 'yc:sync-now' },
      { name: 'clearLocalData', channel: 'yc:clear-local-data' },
      {
        name: 'showNotification',
        channel: 'yc:show-notification',
        args: [{ title: 'Hello' }],
      },
      {
        name: 'authenticateBiometric',
        channel: 'yc:authenticate-biometric',
        args: ['unlock'],
      },
      { name: 'applyTheme', channel: 'yc:apply-theme' },
      {
        name: 'openPatientWindow',
        channel: 'yc:open-patient-window',
        args: ['p-456', 'Buddy'],
      },
      {
        name: 'csRecord',
        channel: 'yc:cs-record',
        args: [{ drug: 'Ketamine' }],
      },
      { name: 'csExport', channel: 'yc:cs-export', args: ['2024-06-15'] },
      {
        name: 'auditAppend',
        channel: 'yc:audit-append',
        args: [{ action: 'create' }],
      },
      {
        name: 'vaultSave',
        channel: 'yc:vault-save',
        args: ['report.pdf', 'base64data', 'application/pdf'],
      },
      { name: 'vaultList', channel: 'yc:vault-list' },
      { name: 'vaultGet', channel: 'yc:vault-get', args: ['doc-1'] },
      { name: 'vaultDelete', channel: 'yc:vault-delete', args: ['doc-1'] },
      { name: 'vaultStats', channel: 'yc:vault-stats' },
      {
        name: 'vaultSaveBuffer',
        channel: 'yc:vault-save-buffer',
        args: ['photo.png', 'iVBORw0KGgo=', 'image/png'],
      },
      { name: 'vaultExport', channel: 'yc:vault-export', args: ['doc-1'] },
      {
        name: 'vaultRevealDoc',
        channel: 'yc:vault-reveal-doc',
        args: ['doc-1'],
      },
      { name: 'vaultOpen', channel: 'yc:vault-open' },
      {
        name: 'deaRegister',
        channel: 'yc:dea-register',
        args: [{ number: 'DEA-123' }],
      },
      {
        name: 'getCachedContent',
        channel: 'yc:get-cached-content',
        args: ['https://example.com'],
      },
      { name: 'getTabs', channel: 'yc:tabs-get' },
      { name: 'newTab', channel: 'yc:tab-new', args: ['https://example.com'] },
      { name: 'closeTab', channel: 'yc:tab-close', args: ['tab-1'] },
      { name: 'activateTab', channel: 'yc:tab-activate', args: ['tab-1'] },
      { name: 'moveTab', channel: 'yc:tab-move', args: ['tab-1', 3] },
      { name: 'pinTab', channel: 'yc:tab-pin', args: ['tab-1', true] },
      { name: 'duplicateTab', channel: 'yc:tab-duplicate', args: ['tab-1'] },
      { name: 'reopenClosedTab', channel: 'yc:tab-reopen-closed' },
      { name: 'setTabZoom', channel: 'yc:tab-set-zoom', args: ['tab-1', 1.5] },
      { name: 'tabSearch', channel: 'yc:tab-search', args: [true] },

      { name: 'stopFindInPage', channel: 'yc:stop-find-in-page' },
      { name: 'openDevTools', channel: 'yc:open-devtools' },
      { name: 'closeDevTools', channel: 'yc:close-devtools' },
      { name: 'toggleTabMute', channel: 'yc:tab-toggle-mute', args: ['tab-1'] },
      { name: 'getTabPreview', channel: 'yc:tab-get-preview', args: ['tab-1'] },
      { name: 'detachTab', channel: 'yc:tab-detach', args: ['tab-1'] },
      {
        name: 'setTabOrientation',
        channel: 'yc:tab-set-orientation',
        args: ['vertical'],
      },
      { name: 'setSplitTab', channel: 'yc:tab-set-split', args: ['tab-1'] },
      { name: 'getAppVersion', channel: 'yc:get-app-version' },
      { name: 'getLastSeenVersion', channel: 'yc:get-last-seen-version' },
      {
        name: 'setLastSeenVersion',
        channel: 'yc:set-last-seen-version',
        args: ['1.0.0'],
      },
      { name: 'dismissWhatsNew', channel: 'yc:dismiss-whats-new' },
    ];

    cases.forEach(({ name, channel, args }) => {
      test(`${name} invokes ${channel}`, async () => {
        const api = mockExposed.ycDesktop[name];
        expect(typeof api).toBe('function');
        const result = await (api as (...a: unknown[]) => Promise<unknown>)(...(args ?? []));
        expect(result).toEqual({ ok: true });
        expect(mockInvoked).toHaveLength(1);
        expect(mockInvoked[0].channel).toBe(channel);
        if (args && args.length > 0) {
          expect(mockInvoked[0].args).toEqual(args);
        }
      });
    });
  });

  describe('onShortcut', () => {
    test('registers a listener and returns a cleanup function', () => {
      const callback = jest.fn();
      const cleanup = mockExposed.ycDesktop.onShortcut(callback);

      expect(typeof cleanup).toBe('function');
      const handler = mockListeners['yc:shortcut'];
      expect(handler).toBeDefined();

      handler({}, 'new-patient');
      expect(callback).toHaveBeenCalledWith('new-patient');

      cleanup();
      expect(mockListeners['yc:shortcut']).toBeUndefined();
    });

    test('calling cleanup removes listener', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const cleanup1 = mockExposed.ycDesktop.onShortcut(cb1);
      mockExposed.ycDesktop.onShortcut(cb2);

      const handler = mockListeners['yc:shortcut'];
      expect(handler).toBeDefined();

      cleanup1();
      handler({}, 'test');
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledWith('test');
    });
  });

  describe('newTab with no args', () => {
    test('invokes yc:tab-new with undefined', async () => {
      mockInvoked.length = 0;
      await mockExposed.ycDesktop.newTab();
      expect(mockInvoked).toHaveLength(1);
      expect(mockInvoked[0].channel).toBe('yc:tab-new');
    });
  });

  describe('findInPage', () => {
    test('invokes yc:find-in-page with wrapped args object', async () => {
      mockInvoked.length = 0;
      await mockExposed.ycDesktop.findInPage('needle', true, false);
      expect(mockInvoked).toHaveLength(1);
      expect(mockInvoked[0].channel).toBe('yc:find-in-page');
      expect(mockInvoked[0].args).toEqual([{ text: 'needle', forward: true, matchCase: false }]);
    });
  });

  describe('setSplitTab with null', () => {
    test('invokes yc:tab-set-split with null', async () => {
      mockInvoked.length = 0;
      await mockExposed.ycDesktop.setSplitTab(null);
      expect(mockInvoked).toHaveLength(1);
      expect(mockInvoked[0].channel).toBe('yc:tab-set-split');
      expect(mockInvoked[0].args).toEqual([null]);
    });
  });

  describe('authenticateBiometric with no reason', () => {
    test('invokes yc:authenticate-biometric with undefined', async () => {
      mockInvoked.length = 0;
      await mockExposed.ycDesktop.authenticateBiometric();
      expect(mockInvoked).toHaveLength(1);
      expect(mockInvoked[0].channel).toBe('yc:authenticate-biometric');
    });
  });

  describe('setSettings with empty object', () => {
    test('invokes yc:set-settings with empty object', async () => {
      mockInvoked.length = 0;
      await mockExposed.ycDesktop.setSettings({});
      expect(mockInvoked).toHaveLength(1);
      expect(mockInvoked[0].channel).toBe('yc:set-settings');
      expect(mockInvoked[0].args).toEqual([{}]);
    });
  });

  describe('windowDragBy', () => {
    test('sends yc:window-drag-by with the pointer deltas (fire-and-forget)', () => {
      mockSent.length = 0;
      const result = mockExposed.ycDesktop.windowDragBy(12, -7);
      expect(result).toBeUndefined();
      expect(mockSent).toHaveLength(1);
      expect(mockSent[0].channel).toBe('yc:window-drag-by');
      expect(mockSent[0].args).toEqual([12, -7]);
    });
  });

  describe('api surface integrity', () => {
    test('every method on YcDesktop is a function', () => {
      const api = mockExposed.ycDesktop;
      const keys: (keyof YcDesktop)[] = Object.keys(
        api as Record<string, unknown>
      ) as (keyof YcDesktop)[];
      keys.forEach((key) => {
        expect(typeof api[key]).toBe('function');
      });
    });
  });
});
