import {
  createKeyboardShortcutManager,
  SHORTCUTS,
  shortcutActionUrl,
} from '../src/ui/keyboard-shortcuts';

describe('createKeyboardShortcutManager', () => {
  const makeDeps = (overrides: Record<string, unknown> = {}) => {
    const handlers: Record<string, () => void> = {};
    const windowEvents: { focus: Array<() => void>; blur: Array<() => void> } = {
      focus: [],
      blur: [],
    };
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
      onWindowFocus: jest.fn((cb: () => void) => windowEvents.focus.push(cb)),
      onWindowBlur: jest.fn((cb: () => void) => windowEvents.blur.push(cb)),
      hasFocusedWindow: jest.fn(() => true),
      defer: jest.fn((cb: () => void) => cb()),
      isLocked: jest.fn(() => false),
      logger: { debug: jest.fn(), warn: jest.fn() },
      windowEvents,
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
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('does not register shortcuts that fail', () => {
    const deps = makeDeps();
    deps.globalShortcut.register = jest.fn<boolean, [accelerator: string, callback: () => void]>(
      () => false
    );
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    expect(mgr.getRegistered()).toHaveLength(0);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  test('unregister() removes all registered shortcuts', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();
    mgr.unregister();

    expect(deps.globalShortcut.unregister).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered()).toHaveLength(0);
  });

  test('open-palette shortcut calls openPalette callback', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();

    const paletteShortcut = SHORTCUTS.find((s) => s.id === 'open-palette')!;
    const registerCall = deps.globalShortcut.register.mock.calls.find(
      (c) => c[0] === paletteShortcut.accelerator
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
        (c) => c[0] === sc.accelerator
      );
      if (registerCall) {
        registerCall[1]();
      }
    }

    expect(deps.navigate).toHaveBeenCalled();
  });

  test('no shortcut acts while the idle lock is up, and all do again after', () => {
    let locked = true;
    const wc = { send: jest.fn(), isDestroyed: () => false };
    const deps = makeDeps({
      isLocked: () => locked,
      focusedWebContents: jest.fn(() => wc),
    });
    const mgr = createKeyboardShortcutManager(deps);
    mgr.register();
    const fireAll = (): void => {
      for (const [, handler] of deps.globalShortcut.register.mock.calls) handler();
    };

    fireAll();
    expect(deps.openPalette).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.focusedWebContents).not.toHaveBeenCalled();

    locked = false;
    fireAll();
    expect(deps.openPalette).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalled();
  });

  describe('shortcut without url falls through to webContents path', () => {
    let origUrl: string | null | undefined;

    beforeEach(() => {
      origUrl = shortcutActionUrl['new-patient'];
      // Make new-patient have no URL to exercise the wc.send() path
      (shortcutActionUrl as Record<string, string | null | undefined>)['new-patient'] = undefined;
    });

    afterEach(() => {
      (shortcutActionUrl as Record<string, string | null | undefined>)['new-patient'] = origUrl;
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
        (c) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
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
        (c) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
      );
      if (call) call[1]();

      expect(wc.send).not.toHaveBeenCalled();
    });

    it('does not send when focusedWebContents returns null', () => {
      const deps = makeDeps({ focusedWebContents: jest.fn(() => null) });
      const mgr = createKeyboardShortcutManager(deps);
      mgr.register();

      const call = deps.globalShortcut.register.mock.calls.find(
        (c) => c[0] === SHORTCUTS.find((s) => s.id === 'new-patient')!.accelerator
      );
      if (call) call[1]();

      expect(deps.logger.debug).toHaveBeenCalled();
    });
  });
});

describe('shortcuts are held only while one of our windows has focus', () => {
  const makeDeps = (overrides: Record<string, unknown> = {}) => {
    const windowEvents: { focus: Array<() => void>; blur: Array<() => void> } = {
      focus: [],
      blur: [],
    };
    return {
      globalShortcut: {
        register: jest.fn(() => true),
        unregister: jest.fn(),
        unregisterAll: jest.fn(),
      },
      focusedWebContents: jest.fn(() => null),
      openPalette: jest.fn(),
      navigate: jest.fn(),
      onWindowFocus: jest.fn((cb: () => void) => windowEvents.focus.push(cb)),
      onWindowBlur: jest.fn((cb: () => void) => windowEvents.blur.push(cb)),
      hasFocusedWindow: jest.fn(() => true),
      defer: jest.fn((cb: () => void) => cb()),
      isLocked: jest.fn(() => false),
      logger: { debug: jest.fn(), warn: jest.fn() },
      windowEvents,
      ...overrides,
    };
  };
  const fire = (deps: ReturnType<typeof makeDeps>, event: 'focus' | 'blur'): void => {
    for (const cb of deps.windowEvents[event]) cb();
  };

  test('start() takes the keys when a window is already focused', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();

    expect(deps.globalShortcut.register).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('start() leaves the keys alone when no window is focused, and takes them on focus', () => {
    const deps = makeDeps({ hasFocusedWindow: jest.fn(() => false) });
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();

    expect(deps.globalShortcut.register).not.toHaveBeenCalled();
    expect(mgr.getRegistered()).toHaveLength(0);

    fire(deps, 'focus');
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('blur releases the keys back to the rest of the machine', () => {
    const hasFocusedWindow = jest.fn(() => true);
    const deps = makeDeps({ hasFocusedWindow });
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);

    hasFocusedWindow.mockReturnValue(false);
    fire(deps, 'blur');

    expect(deps.globalShortcut.unregister).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered()).toHaveLength(0);
  });

  test('moving between our own windows keeps the keys registered', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();

    // hasFocusedWindow still true: the settings window took focus, not another app.
    fire(deps, 'blur');

    expect(deps.globalShortcut.unregister).not.toHaveBeenCalled();
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('the blur decision is deferred, not taken while focus is still moving', () => {
    const pending: Array<() => void> = [];
    const hasFocusedWindow = jest.fn(() => true);
    const deps = makeDeps({
      hasFocusedWindow,
      defer: jest.fn((cb: () => void) => pending.push(cb)),
    });
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();

    hasFocusedWindow.mockReturnValue(false);
    fire(deps, 'blur');
    expect(deps.globalShortcut.unregister).not.toHaveBeenCalled();

    // The window taking over gets focus before the deferred check runs.
    hasFocusedWindow.mockReturnValue(true);
    for (const cb of pending) cb();
    expect(deps.globalShortcut.unregister).not.toHaveBeenCalled();
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('a second focus does not register the same accelerators twice', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();
    fire(deps, 'focus');

    expect(deps.globalShortcut.register).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered()).toHaveLength(SHORTCUTS.length);
  });

  test('stop() releases every key it holds', () => {
    const deps = makeDeps();
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();
    mgr.stop();

    expect(deps.globalShortcut.unregister).toHaveBeenCalledTimes(SHORTCUTS.length);
    expect(mgr.getRegistered()).toHaveLength(0);
  });

  test('the real defer runs the check on a later tick', async () => {
    const hasFocusedWindow = jest.fn(() => true);
    const deps = makeDeps({ hasFocusedWindow, defer: undefined });
    const mgr = createKeyboardShortcutManager(deps);
    mgr.start();

    hasFocusedWindow.mockReturnValue(false);
    fire(deps, 'blur');
    expect(deps.globalShortcut.unregister).not.toHaveBeenCalled();

    await new Promise((resolve) => setImmediate(resolve));
    expect(mgr.getRegistered()).toHaveLength(0);
  });
});
