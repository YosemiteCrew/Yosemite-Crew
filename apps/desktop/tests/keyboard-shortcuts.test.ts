import {
  createKeyboardShortcutManager,
  SHORTCUTS,
  shortcutActionUrl,
} from '../src/ui/keyboard-shortcuts';

describe('createKeyboardShortcutManager', () => {
  const makeDeps = (overrides: Record<string, unknown> = {}) => {
    const handlers: Record<string, () => void> = {};
    return {
      globalShortcut: {
        register: jest.fn((accelerator: string, callback: () => void) => {
          handlers[accelerator] = callback;
          return true;
        }),
        unregister: jest.fn(),
        unregisterAll: jest.fn(),
      },
      focusedWebContents: jest.fn(() => null),
      openPalette: jest.fn(),
      navigate: jest.fn(),
      logger: { debug: jest.fn(), warn: jest.fn() },
      ...overrides,
    };
  };

  test('inbox and billing map to the real chat and finance routes', () => {
    expect(shortcutActionUrl.inbox).toBe('yosemitecrew://chat');
    expect(shortcutActionUrl.billing).toBe('yosemitecrew://finance');
  });

  test('registers all shortcuts on register()', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    expect(deps.globalShortcut.register).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered().length).toBe(SHORTCUTS.length);
  });

  test('does not register shortcuts that fail', () => {
    const deps = makeDeps();
    deps.globalShortcut.register = jest.fn(() => false);
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    expect(mgr.getRegistered().length).toBe(0);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  test('unregister() removes all registered shortcuts', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();
    mgr.unregister();

    expect(deps.globalShortcut.unregister).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered().length).toBe(0);
  });

  test('open-palette shortcut calls openPalette callback', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    const paletteShortcut = SHORTCUTS.find((s) => s.id === 'open-palette')!;
    const registerCall = deps.globalShortcut.register.mock.calls.find(
      (c: string[]) => c[0] === paletteShortcut.accelerator
    );
    if (registerCall) {
      registerCall[1]();
      expect(deps.openPalette).toHaveBeenCalledTimes(1);
    }
  });

  test('navigation shortcuts call navigate with deep link URL', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    const navShortcuts = SHORTCUTS.filter(
      (s) => s.id !== 'open-palette' && s.id !== 'search' && s.id !== 'new-patient'
    );
    for (const sc of navShortcuts) {
      const registerCall = deps.globalShortcut.register.mock.calls.find(
        (c: string[]) => c[0] === sc.accelerator
      );
      if (registerCall) {
        registerCall[1]();
      }
    }

    expect(deps.navigate).toHaveBeenCalled();
  });

  describe('shortcut without url falls through to webContents path', () => {
    let origUrl: string | null;

    beforeEach(() => {
      origUrl = shortcutActionUrl['new-patient'];
      // Make new-patient have no URL to exercise the wc.send() path
      (shortcutActionUrl as Record<string, string | null | undefined>)['new-patient'] = undefined;
    });

    afterEach(() => {
      (shortcutActionUrl as Record<string, string | null>)['new-patient'] = origUrl;
    });

    it('sends shortcut to webContents when focused and not destroyed', () => {
      const wc = {
        send: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
      };
      const deps = makeDeps({ focusedWebContents: jest.fn(() => wc) });
      const mgr = createKeyboardShortcutManager(deps);
      mgr.register();

      const call = deps.globalShortcut.register.mock.calls.find(
        (c: string[]) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
      );
      if (call) call[1]();

      expect(wc.send).toHaveBeenCalledWith('yc:shortcut', 'new-patient');
    });

    it('does not send when focused webContents is destroyed', () => {
      const wc = {
        send: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(true),
      };
      const deps = makeDeps({ focusedWebContents: jest.fn(() => wc) });
      const mgr = createKeyboardShortcutManager(deps);
      mgr.register();

      const call = deps.globalShortcut.register.mock.calls.find(
        (c: string[]) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
      );
      if (call) call[1]();

      expect(wc.send).not.toHaveBeenCalled();
    });

    it('does not send when focusedWebContents returns null', () => {
      const deps = makeDeps({ focusedWebContents: jest.fn(() => null) });
      const mgr = createKeyboardShortcutManager(deps);
      mgr.register();

      const call = deps.globalShortcut.register.mock.calls.find(
        (c: string[]) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
      );
      if (call) call[1]();

      expect(deps.logger.debug).toHaveBeenCalled();
    });
  });
});
