'use strict';

interface HandlerMap {
  [event: string]: (...args: unknown[]) => void;
}

let viewEventHandlers: HandlerMap = {};

// Set to true in a test to make the next create()'s loadURL reject.
let rejectLoadURL = false;

const createFakeWebContents = () => ({
  loadURL: jest.fn(() =>
    rejectLoadURL
      ? Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))
      : Promise.resolve(undefined)
  ),
  close: jest.fn(),
  on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    viewEventHandlers[event] = handler;
  }),
  setWindowOpenHandler: jest.fn(),
  setZoomFactor: jest.fn(),
  isAudioMuted: jest.fn().mockReturnValue(false),
  setAudioMuted: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  getURL: jest.fn().mockReturnValue('https://example.com/page'),
  navigationHistory: { goBack: jest.fn(), goForward: jest.fn() },
});

jest.mock('electron', () => ({
  WebContentsView: class {
    webContents = createFakeWebContents();
    setBounds = jest.fn();
  },
}));

import { createTabViewHost } from '../src/ui/tab-view-host';

const dummyLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const baseWebPrefs = {
  preload: '/fake/preload.js',
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  disableBlinkFeatures: 'Auxclick',
};

const createHost = (extra: Partial<Parameters<typeof createTabViewHost>[0]> = {}) =>
  createTabViewHost({
    logger: dummyLogger,
    webPreferences: baseWebPrefs,
    ...extra,
  });

describe('TabViewHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    viewEventHandlers = {};
    rejectLoadURL = false;
  });

  describe('create', () => {
    it('creates a WebContentsView and stores it', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      expect(view).toBeDefined();
      expect(view.webContents).toBeDefined();
    });

    it('returns existing view for duplicate id', () => {
      const host = createHost();
      const v1 = host.create('tab_1', 'https://example.com');
      const v2 = host.create('tab_1', 'https://other.com');
      expect(v1).toBe(v2);
    });

    it('loadURL catch logs warning on rejection', async () => {
      rejectLoadURL = true;
      const host = createHost();
      host.create('tab_1', 'https://fail.example');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(dummyLogger.warn).toHaveBeenCalledWith('tab_view_load_failed', {
        id: 'tab_1',
        url: 'https://fail.example',
        error: 'net::ERR_INTERNET_DISCONNECTED',
      });
    });
  });

  describe('get / getUrl', () => {
    it('returns undefined for unknown id', () => {
      const host = createHost();
      expect(host.get('nonexistent')).toBeUndefined();
      expect(host.getUrl('nonexistent')).toBe('');
    });

    it('returns the view and url for a known id', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      expect(host.get('tab_1')).toBeDefined();
      expect(host.getUrl('tab_1')).toBe('https://example.com');
    });
  });

  describe('attach / detach', () => {
    it('attach sets bounds on the view', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      const bounds = { x: 0, y: 40, width: 800, height: 560 };
      host.attach('tab_1', bounds);
      const view = host.get('tab_1') as { setBounds: jest.Mock };
      expect(view.setBounds).toHaveBeenCalledWith(bounds);
    });

    it('detach sets offscreen bounds', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      host.detach('tab_1');
      const view = host.get('tab_1') as { setBounds: jest.Mock };
      expect(view.setBounds).toHaveBeenCalledWith({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    });

    it('does not throw for unknown id', () => {
      const host = createHost();
      expect(() => host.attach('x', { x: 0, y: 0, width: 100, height: 100 })).not.toThrow();
      expect(() => host.detach('x')).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('destroys a tab and removes it from the map', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      expect(host.destroy('tab_1')).toBe(true);
      expect(host.get('tab_1')).toBeUndefined();
    });

    it('returns false for unknown id', () => {
      const host = createHost();
      expect(host.destroy('nonexistent')).toBe(false);
    });

    it('calls webContents.close on destroy', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      host.destroy('tab_1');
      expect(view.webContents.close).toHaveBeenCalled();
    });
  });

  describe('setBounds', () => {
    it('sets bounds on an existing view', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      const result = host.setBounds('tab_1', {
        x: 0,
        y: 40,
        width: 800,
        height: 560,
      });
      expect(result).toBe(true);
    });

    it('returns false for unknown id', () => {
      const host = createHost();
      expect(host.setBounds('x', { x: 0, y: 0, width: 100, height: 100 })).toBe(false);
    });
  });

  describe('destroyAll', () => {
    it('destroys all tabs', () => {
      const host = createHost();
      host.create('tab_1', 'https://a.com');
      host.create('tab_2', 'https://b.com');
      host.create('tab_3', 'https://c.com');
      host.destroyAll();
      expect(host.get('tab_1')).toBeUndefined();
      expect(host.get('tab_2')).toBeUndefined();
      expect(host.get('tab_3')).toBeUndefined();
    });
  });

  describe('setZoom', () => {
    it('sets a positive zoom factor', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      const result = host.setZoom('tab_1', 1.5);
      expect(result).toBe(true);
      expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(1.5);
    });

    it('defaults to 1 for zero or negative factor', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      host.setZoom('tab_1', 0);
      expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(1);

      host.setZoom('tab_1', -1);
      expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(1);
    });

    it('returns false for unknown id', () => {
      const host = createHost();
      expect(host.setZoom('x', 1.5)).toBe(false);
    });
  });

  describe('toggleMute', () => {
    it('toggles mute on and calls onUpdate', () => {
      const onUpdate = jest.fn();
      const host = createHost({ onUpdate });
      const view = host.create('tab_1', 'https://example.com');
      view.webContents.isAudioMuted.mockReturnValue(false);
      const result = host.toggleMute('tab_1');
      expect(result).toBe(true);
      expect(view.webContents.setAudioMuted).toHaveBeenCalledWith(true);
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { muted: true });
    });

    it('toggles mute off and calls onUpdate', () => {
      const onUpdate = jest.fn();
      const host = createHost({ onUpdate });
      const view = host.create('tab_1', 'https://example.com');
      view.webContents.isAudioMuted.mockReturnValue(true);
      host.toggleMute('tab_1');
      expect(view.webContents.setAudioMuted).toHaveBeenCalledWith(false);
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { muted: false });
    });

    it('returns false for unknown id', () => {
      const host = createHost();
      expect(host.toggleMute('x')).toBe(false);
    });
  });

  describe('getWebContents', () => {
    it('returns webContents for known id', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      expect(host.getWebContents('tab_1')).toBe(view.webContents);
    });

    it('returns undefined for unknown id', () => {
      const host = createHost();
      expect(host.getWebContents('x')).toBeUndefined();
    });
  });

  describe('extract', () => {
    it('returns and removes the view from management', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      const extracted = host.extract('tab_1');
      expect(extracted).toBe(view);
      expect(host.get('tab_1')).toBeUndefined();
    });

    it('returns undefined for unknown id', () => {
      const host = createHost();
      expect(host.extract('x')).toBeUndefined();
    });
  });

  describe('event handlers', () => {
    it('page-title-updated calls onUpdate', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['page-title-updated'](undefined, 'New Title');
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { title: 'New Title' });
    });

    it('page-title-updated logs debug', () => {
      createHost().create('tab_1', 'https://example.com');
      viewEventHandlers['page-title-updated'](undefined, 'New Title');
      expect(dummyLogger.debug).toHaveBeenCalledWith('tab_title_updated', {
        id: 'tab_1',
        title: 'New Title',
      });
    });

    it('page-favicon-updated calls onUpdate with first favicon', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['page-favicon-updated'](undefined, ['https://favicon.ico']);
      expect(onUpdate).toHaveBeenCalledWith('tab_1', {
        favicon: 'https://favicon.ico',
      });
    });

    it('page-favicon-updated handles empty list', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['page-favicon-updated'](undefined, []);
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { favicon: '' });
    });

    it('did-start-loading calls onUpdate with loading true', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-start-loading']();
      expect(onUpdate).toHaveBeenCalledWith('tab_1', {
        loading: true,
        error: null,
      });
    });

    it('did-stop-loading calls onUpdate with loading false', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-stop-loading']();
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { loading: false });
    });

    it('did-stop-loading applies zoom when getZoom returns positive', () => {
      const getZoom = jest.fn().mockReturnValue(1.25);
      const host = createHost({ getZoom });
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['did-stop-loading']();
      expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(1.25);
    });

    it('did-stop-loading skips zoom when getZoom returns 0', () => {
      const getZoom = jest.fn().mockReturnValue(0);
      const host = createHost({ getZoom });
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['did-stop-loading']();
      expect(view.webContents.setZoomFactor).not.toHaveBeenCalled();
    });

    it('did-fail-load calls onUpdate with error', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-fail-load'](undefined, -3, 'ERR_CONNECTION_REFUSED');
      expect(onUpdate).toHaveBeenCalledWith('tab_1', {
        error: 'ERR_CONNECTION_REFUSED',
        loading: false,
      });
    });

    it('did-fail-load logs warning', () => {
      createHost().create('tab_1', 'https://example.com');
      viewEventHandlers['did-fail-load'](undefined, -3, 'ERR_CONNECTION_REFUSED');
      expect(dummyLogger.warn).toHaveBeenCalledWith('tab_fail_load', {
        id: 'tab_1',
        error: 'ERR_CONNECTION_REFUSED',
      });
    });

    it('did-fail-load surfaces a main-frame failure via onLoadError', () => {
      const onLoadError = jest.fn();
      createHost({ onLoadError }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-fail-load'](
        undefined,
        -106,
        'ERR_INTERNET_DISCONNECTED',
        'https://example.com/app',
        true
      );
      expect(onLoadError).toHaveBeenCalledWith('tab_1', {
        url: 'https://example.com/app',
        error: 'ERR_INTERNET_DISCONNECTED',
        code: -106,
      });
    });

    it('did-fail-load ignores intentional aborts (ERR_ABORTED) for onLoadError', () => {
      const onLoadError = jest.fn();
      createHost({ onLoadError }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-fail-load'](undefined, -3, 'ERR_ABORTED', 'https://example.com', true);
      expect(onLoadError).not.toHaveBeenCalled();
    });

    it('did-fail-load ignores subframe failures for onLoadError', () => {
      const onLoadError = jest.fn();
      createHost({ onLoadError }).create('tab_1', 'https://example.com');
      viewEventHandlers['did-fail-load'](
        undefined,
        -106,
        'ERR_FAILED',
        'https://ads.example',
        false
      );
      expect(onLoadError).not.toHaveBeenCalled();
    });

    it('media-started-playing calls onUpdate with audible true', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['media-started-playing']();
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { audible: true });
    });

    it('media-paused calls onUpdate with audible false', () => {
      const onUpdate = jest.fn();
      createHost({ onUpdate }).create('tab_1', 'https://example.com');
      viewEventHandlers['media-paused']();
      expect(onUpdate).toHaveBeenCalledWith('tab_1', { audible: false });
    });

    it('input-event mouseUp button 3 goes back', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['input-event'](undefined, {
        type: 'mouseUp',
        button: 3,
      });
      expect(view.webContents.navigationHistory.goBack).toHaveBeenCalled();
      expect(view.webContents.navigationHistory.goForward).not.toHaveBeenCalled();
    });

    it('input-event mouseUp button 4 goes forward', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['input-event'](undefined, {
        type: 'mouseUp',
        button: 4,
      });
      expect(view.webContents.navigationHistory.goForward).toHaveBeenCalled();
    });

    it('input-event non-mouseUp type does nothing', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['input-event'](undefined, {
        type: 'keyDown',
        key: 'a',
      });
      expect(view.webContents.navigationHistory.goBack).not.toHaveBeenCalled();
      expect(view.webContents.navigationHistory.goForward).not.toHaveBeenCalled();
    });

    it('input-event unknown button does nothing', () => {
      const host = createHost();
      const view = host.create('tab_1', 'https://example.com');
      viewEventHandlers['input-event'](undefined, {
        type: 'mouseUp',
        button: 999,
      });
      expect(view.webContents.navigationHistory.goBack).not.toHaveBeenCalled();
      expect(view.webContents.navigationHistory.goForward).not.toHaveBeenCalled();
    });

    it('did-finish-load forwards webContents and http status to onDidFinishLoad', () => {
      const onDidFinishLoad = jest.fn();
      const host = createHost({ onDidFinishLoad });
      const view = host.create('tab_1', 'https://example.com');
      // A prior did-navigate records the main-frame status used by the cache hook.
      viewEventHandlers['did-navigate'](undefined, 'https://example.com/page', 200);
      viewEventHandlers['did-finish-load']();
      expect(onDidFinishLoad).toHaveBeenCalledWith('tab_1', view.webContents, 200);
    });

    it('did-finish-load is not registered without onDidFinishLoad', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      expect('did-finish-load' in viewEventHandlers).toBe(false);
    });

    it('did-finish-load skips a destroyed webContents', () => {
      const onDidFinishLoad = jest.fn();
      const host = createHost({ onDidFinishLoad });
      const view = host.create('tab_1', 'https://example.com');
      (view.webContents.isDestroyed as jest.Mock).mockReturnValue(true);
      viewEventHandlers['did-finish-load']();
      expect(onDidFinishLoad).not.toHaveBeenCalled();
    });

    it('will-navigate calls onNavigate when provided', () => {
      const onNavigate = jest.fn();
      const host = createHost({ onNavigate });
      host.create('tab_1', 'https://example.com');
      const ev = { preventDefault: jest.fn() };
      viewEventHandlers['will-navigate'](ev, 'https://other.com');
      expect(onNavigate).toHaveBeenCalledWith(ev, 'https://other.com');
    });

    it('will-redirect calls onNavigate when provided', () => {
      const onNavigate = jest.fn();
      const host = createHost({ onNavigate });
      host.create('tab_1', 'https://example.com');
      const ev = { preventDefault: jest.fn() };
      viewEventHandlers['will-redirect'](ev, 'https://other.com');
      expect(onNavigate).toHaveBeenCalled();
    });

    it('will-navigate and will-redirect are not registered without onNavigate', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      expect('will-navigate' in viewEventHandlers).toBe(false);
      expect('will-redirect' in viewEventHandlers).toBe(false);
    });

    it('setWindowOpenHandler returns deny when onWindowOpen is not set', () => {
      const host = createHost();
      host.create('tab_1', 'https://example.com');
      const view = host.get('tab_1');
      if (view) {
        const handler = (view.webContents.setWindowOpenHandler as jest.Mock).mock.calls[0][0];
        const result = handler({ url: 'https://popup.com' });
        expect(result).toEqual({ action: 'deny' });
      }
    });

    it('setWindowOpenHandler returns onWindowOpen result when provided', () => {
      const onWindowOpen = jest
        .fn()
        .mockReturnValue({ action: 'allow', overrideBrowserWindowOptions: {} });
      const host = createHost({ onWindowOpen });
      host.create('tab_1', 'https://example.com');
      const view = host.get('tab_1');
      if (view) {
        const handler = (view.webContents.setWindowOpenHandler as jest.Mock).mock.calls[0][0];
        const result = handler({ url: 'https://popup.com' });
        expect(onWindowOpen).toHaveBeenCalledWith('https://popup.com');
        expect(result).toEqual({
          action: 'allow',
          overrideBrowserWindowOptions: {},
        });
      }
    });
  });
});
