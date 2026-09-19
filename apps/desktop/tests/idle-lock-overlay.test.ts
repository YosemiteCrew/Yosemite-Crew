'use strict';

import {
  createIdleLockOverlay,
  MAX_LOCK_PAGE_REMOUNTS,
  type LockContents,
  type LockWindow,
} from '../src/ui/idle-lock-overlay';

type InputListener = (event: { preventDefault: () => void }) => void;

// A web contents stand-in: records focus() and lets a test fire
// before-input-event the way Electron does for a key press, and
// render-process-gone the way it does when the renderer dies.
const makeContents = () => {
  const listeners: InputListener[] = [];
  const gone: Array<() => void> = [];
  let destroyed = false;
  const contents = {
    focus: jest.fn(),
    isDestroyed: () => destroyed,
    on: jest.fn(
      (
        event: 'before-input-event' | 'render-process-gone',
        listener: InputListener | (() => void)
      ) => {
        if (event === 'render-process-gone') gone.push(listener as () => void);
        else listeners.push(listener);
      }
    ),
    destroy: () => {
      destroyed = true;
    },
    // Returns whether the key press was dropped.
    press: (): boolean => {
      const event = { preventDefault: jest.fn() };
      for (const listener of listeners) listener(event);
      return event.preventDefault.mock.calls.length > 0;
    },
    crash: (): void => {
      for (const listener of gone) listener();
    },
  };
  return contents satisfies LockContents;
};

// A BrowserWindow stand-in that tracks whether it is on screen, reporting it
// the way Electron does: a minimized window is not visible. Its own show(),
// focus() and the like put it on screen with no event at all, as they do on
// macOS while the display sleeps; `native` keeps those originals, since the
// lock replaces them on a window it holds. reveal() is something outside the
// app showing it, with the event that follows: 'show', 'focus', or 'restore'
// from the Dock.
const makeWindow = ({ minimized = false, shown = true } = {}) => {
  const listeners: Record<string, Array<() => void>> = {};
  const emit = (event: string) => {
    for (const listener of listeners[event] ?? []) listener();
  };
  let onScreen = shown;
  let isMinimized = minimized;
  let destroyed = false;
  const putOnScreen = () => {
    onScreen = true;
  };
  const native = {
    show: jest.fn(putOnScreen),
    showInactive: jest.fn(putOnScreen),
    focus: jest.fn(putOnScreen),
    restore: jest.fn(() => {
      onScreen = true;
      isMinimized = false;
    }),
  };
  const win = {
    ...native,
    native,
    isDestroyed: () => destroyed,
    isMinimized: () => isMinimized,
    isVisible: () => onScreen && !isMinimized,
    // Hiding a minimized window leaves it minimized, as Electron reports it.
    hide: jest.fn(() => {
      onScreen = false;
    }),
    minimize: jest.fn(() => {
      isMinimized = true;
    }),
    destroy: jest.fn(() => {
      destroyed = true;
      onScreen = false;
      emit('closed');
    }),
    on: jest.fn((event: 'show' | 'focus' | 'restore' | 'closed', listener: () => void) => {
      (listeners[event] ??= []).push(listener);
    }),
    // How a new window's constructor shows it: no event at all.
    appear: putOnScreen,
    reveal: (event: 'show' | 'focus' | 'restore' = 'show') => {
      onScreen = true;
      if (event === 'restore') isMinimized = false;
      emit(event);
    },
    // Closed by the user or the page: gone without the lock's involvement.
    closeNow: () => {
      destroyed = true;
      onScreen = false;
      emit('closed');
    },
    // Destroyed but its 'closed' event not delivered yet.
    destroyQuietly: () => {
      destroyed = true;
    },
    onScreen: () => onScreen,
  };
  return win satisfies LockWindow;
};

const makeDeps = () => {
  const lockPage = makeContents();
  const tab = makeContents();
  return {
    lockPage,
    tab,
    deps: {
      mount: jest.fn((): LockContents => lockPage),
      unmount: jest.fn(),
      workspace: jest.fn((): LockContents | null => tab),
    },
  };
};

describe('createIdleLockOverlay', () => {
  test('starts hidden', () => {
    const overlay = createIdleLockOverlay(makeDeps().deps);
    expect(overlay.isVisible()).toBe(false);
  });

  test('show() mounts once and marks visible', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });

  test('show() is idempotent while already visible', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });

  test('hide() unmounts once and marks hidden', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    expect(deps.unmount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(false);
  });

  test('hide() is a no-op when not visible', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.hide();
    expect(deps.unmount).not.toHaveBeenCalled();
    expect(tab.focus).not.toHaveBeenCalled();
    expect(overlay.isVisible()).toBe(false);
  });

  test('supports repeated show/hide cycles', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    overlay.show();
    expect(deps.mount).toHaveBeenCalledTimes(2);
    expect(deps.unmount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
  });
});

describe('idle lock focus', () => {
  test('show() focuses the lock page it mounted', () => {
    const { deps, lockPage, tab } = makeDeps();
    createIdleLockOverlay(deps).show();
    expect(lockPage.focus).toHaveBeenCalledTimes(1);
    expect(tab.focus).not.toHaveBeenCalled();
  });

  test('hide() hands focus back to the workspace, after the overlay is gone', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    expect(tab.focus).toHaveBeenCalledTimes(1);
    expect(deps.unmount.mock.invocationCallOrder[0]).toBeLessThan(
      tab.focus.mock.invocationCallOrder[0]!
    );
  });

  test('hide() skips a workspace that is gone', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    tab.destroy();
    overlay.hide();
    expect(tab.focus).not.toHaveBeenCalled();

    overlay.show();
    deps.workspace.mockReturnValueOnce(null);
    expect(() => overlay.hide()).not.toThrow();
  });

  test('refocus() puts focus back on the lock page while locked, and only then', () => {
    const { deps, lockPage } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.refocus();
    expect(lockPage.focus).not.toHaveBeenCalled();

    overlay.show();
    overlay.refocus();
    expect(lockPage.focus).toHaveBeenCalledTimes(2);

    overlay.hide();
    overlay.refocus();
    expect(lockPage.focus).toHaveBeenCalledTimes(2);
  });

  test('refocus() skips a lock page that is gone', () => {
    const { deps, lockPage } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    lockPage.destroy();
    overlay.refocus();
    expect(lockPage.focus).toHaveBeenCalledTimes(1);
  });
});

describe('idle lock input hold', () => {
  test('a tab takes input until the lock engages, and none while it is up', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.holdInput(tab);
    expect(tab.press()).toBe(false);

    overlay.show();
    expect(tab.press()).toBe(true);
  });

  test('the lock page itself keeps taking input', () => {
    const { deps, lockPage } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.holdInput(lockPage);
    overlay.show();
    expect(lockPage.press()).toBe(false);
  });

  test('the hold lifts on unlock', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.holdInput(tab);
    overlay.show();
    overlay.hide();
    expect(tab.press()).toBe(false);
  });

  test('a tab opened during the lock is held too', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    const opened = makeContents();
    overlay.holdInput(opened);
    expect(opened.press()).toBe(true);
  });

  test('only the current lock page is exempt, not one from an earlier lock', () => {
    const { deps } = makeDeps();
    const earlier = makeContents();
    const current = makeContents();
    deps.mount.mockReturnValueOnce(earlier).mockReturnValueOnce(current);
    const overlay = createIdleLockOverlay(deps);
    overlay.holdInput(earlier);
    overlay.holdInput(current);
    overlay.show();
    overlay.hide();
    overlay.show();
    expect(earlier.press()).toBe(true);
    expect(current.press()).toBe(false);
  });
});

describe('idle lock windows', () => {
  test('a window open when the lock engages is hidden, and comes back on unlock', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const pinned = makeWindow();
    overlay.holdWindow(pinned);
    expect(pinned.onScreen()).toBe(true);
    expect(overlay.isHiding(pinned)).toBe(false);

    overlay.show();
    expect(pinned.onScreen()).toBe(false);
    expect(overlay.isHiding(pinned)).toBe(true);

    overlay.hide();
    expect(pinned.onScreen()).toBe(true);
    expect(pinned.native.showInactive).toHaveBeenCalledTimes(1);
    expect(pinned.minimize).not.toHaveBeenCalled();
    expect(overlay.isHiding(pinned)).toBe(false);
  });

  test('windows come back before the workspace takes focus, so it keeps it', () => {
    const { deps, tab } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const pinned = makeWindow();
    overlay.holdWindow(pinned);
    overlay.show();
    overlay.hide();
    expect(pinned.native.showInactive.mock.invocationCallOrder[0]).toBeLessThan(
      tab.focus.mock.invocationCallOrder[0]!
    );
  });

  test('a window minimized when the lock engages is hidden, and comes back minimized', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const docked = makeWindow({ minimized: true });
    overlay.holdWindow(docked);
    overlay.show();
    expect(docked.hide).toHaveBeenCalledTimes(1);
    // Restored from the Dock mid-lock, it goes straight back.
    docked.reveal('restore');
    expect(docked.onScreen()).toBe(false);
    overlay.hide();
    expect(docked.minimize).toHaveBeenCalledTimes(1);
    expect(docked.isMinimized()).toBe(true);
  });

  test('a window opened during the lock is hidden once its constructor is done', async () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    const patient = makeWindow({ shown: false });
    // Registered from browser-window-created, inside the constructor, which
    // goes on to show the window.
    overlay.holdWindow(patient);
    patient.appear();
    await Promise.resolve();
    expect(patient.onScreen()).toBe(false);
    overlay.hide();
    expect(patient.onScreen()).toBe(true);
  });

  test.each(['show', 'focus', 'restore'] as const)(
    'a window brought back during the lock (%s) goes straight back',
    (event) => {
      const { deps } = makeDeps();
      const overlay = createIdleLockOverlay(deps);
      const prefs = makeWindow();
      overlay.holdWindow(prefs);
      overlay.show();
      prefs.reveal(event);
      expect(prefs.onScreen()).toBe(false);
      expect(prefs.hide).toHaveBeenCalledTimes(2);
      // Still restored once, as it was before the lock (not minimized).
      overlay.hide();
      expect(prefs.native.showInactive).toHaveBeenCalledTimes(1);
      expect(prefs.minimize).not.toHaveBeenCalled();
    }
  );

  test.each(['show', 'showInactive', 'focus', 'restore'] as const)(
    'a window the app brings forward during the lock (%s) stays hidden, with no event needed',
    (call) => {
      const { deps } = makeDeps();
      const overlay = createIdleLockOverlay(deps);
      const prefs = makeWindow();
      overlay.holdWindow(prefs);
      overlay.show();
      prefs[call]();
      expect(prefs.native[call]).not.toHaveBeenCalled();
      expect(prefs.onScreen()).toBe(false);
      overlay.hide();
      expect(prefs.onScreen()).toBe(true);
      expect(prefs.minimize).not.toHaveBeenCalled();
    }
  );

  test('a window never shown when the lock engages is left alone, and unlock does not show it', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const palette = makeWindow({ shown: false });
    overlay.holdWindow(palette);
    overlay.show();
    expect(palette.hide).not.toHaveBeenCalled();
    // Still one the lock keeps off the screen, so a Dock click reopens the workspace.
    expect(overlay.isHiding(palette)).toBe(true);
    overlay.hide();
    expect(palette.native.showInactive).not.toHaveBeenCalled();
    expect(palette.onScreen()).toBe(false);
    expect(overlay.isHiding(palette)).toBe(false);
  });

  test('a window first shown during the lock stays hidden, and appears on unlock', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const late = makeWindow({ shown: false });
    overlay.holdWindow(late);
    overlay.show();
    late.show();
    expect(late.onScreen()).toBe(false);
    overlay.hide();
    expect(late.onScreen()).toBe(true);
  });

  test('windows are left alone while unlocked', async () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const pinned = makeWindow();
    overlay.holdWindow(pinned);
    await Promise.resolve();
    pinned.reveal();
    overlay.show();
    overlay.hide();
    pinned.reveal('focus');
    await Promise.resolve();
    expect(pinned.hide).toHaveBeenCalledTimes(1);
    expect(pinned.onScreen()).toBe(true);
    // The app's own calls go through as they are.
    pinned.minimize();
    pinned.restore();
    pinned.focus();
    expect(pinned.native.restore).toHaveBeenCalledTimes(1);
    expect(pinned.native.focus).toHaveBeenCalledTimes(1);
    expect(pinned.isMinimized()).toBe(false);
  });

  test('a window closed during the lock is not brought back', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const closed = makeWindow();
    const gone = makeWindow();
    overlay.holdWindow(closed);
    overlay.holdWindow(gone);
    overlay.show();
    closed.closeNow();
    gone.destroyQuietly();
    // Asking a destroyed window to show itself does not reach it.
    gone.show();
    expect(gone.hide).toHaveBeenCalledTimes(1);
    expect(overlay.isHiding(closed)).toBe(false);
    overlay.hide();
    expect(closed.native.showInactive).not.toHaveBeenCalled();
    expect(gone.native.showInactive).not.toHaveBeenCalled();

    // Nor hidden by, or counted in, a later lock.
    overlay.show();
    expect(closed.hide).toHaveBeenCalledTimes(1);
    expect(overlay.isHiding(closed)).toBe(false);
  });

  test('every lock hides the windows again', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const pinned = makeWindow();
    overlay.holdWindow(pinned);
    overlay.show();
    overlay.hide();
    overlay.show();
    expect(pinned.onScreen()).toBe(false);
    expect(overlay.isHiding(pinned)).toBe(true);
  });

  test('closeWindows() destroys every held window, and unlock brings none back', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const hidden = makeWindow();
    const alreadyGone = makeWindow();
    overlay.holdWindow(hidden);
    overlay.holdWindow(alreadyGone);
    overlay.show();
    alreadyGone.destroyQuietly();
    overlay.closeWindows();
    expect(hidden.destroy).toHaveBeenCalledTimes(1);
    expect(alreadyGone.destroy).not.toHaveBeenCalled();
    expect(overlay.isHiding(hidden)).toBe(false);

    overlay.hide();
    expect(hidden.native.showInactive).not.toHaveBeenCalled();
    // And a later lock has nothing left to hide.
    overlay.show();
    expect(hidden.hide).toHaveBeenCalledTimes(1);
  });

  test('closeWindows() also closes windows that were never hidden', () => {
    const { deps } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    const prefs = makeWindow();
    overlay.holdWindow(prefs);
    overlay.closeWindows();
    expect(prefs.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('idle lock page crash', () => {
  test('a lock page whose renderer dies is replaced, focused, and exempt from the hold', () => {
    const { deps, lockPage } = makeDeps();
    const fresh = makeContents();
    deps.mount.mockReturnValueOnce(lockPage).mockReturnValueOnce(fresh);
    const overlay = createIdleLockOverlay(deps);
    overlay.holdInput(lockPage);
    overlay.holdInput(fresh);
    overlay.show();

    lockPage.crash();
    expect(deps.unmount).toHaveBeenCalledTimes(1);
    expect(deps.mount).toHaveBeenCalledTimes(2);
    expect(fresh.focus).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(true);
    expect(fresh.press()).toBe(false);
    expect(lockPage.press()).toBe(true);
    // The old page's own exit (from being closed) does not count as a crash.
    lockPage.crash();
    expect(deps.mount).toHaveBeenCalledTimes(2);
  });

  test(`replacement stops after ${MAX_LOCK_PAGE_REMOUNTS} crashes in one lock, and resets per lock`, () => {
    const { deps } = makeDeps();
    const pages: Array<ReturnType<typeof makeContents>> = [];
    deps.mount.mockImplementation(() => {
      const page = makeContents();
      pages.push(page);
      return page;
    });
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    for (let i = 0; i < MAX_LOCK_PAGE_REMOUNTS + 2; i++) pages[pages.length - 1]!.crash();
    expect(deps.mount).toHaveBeenCalledTimes(MAX_LOCK_PAGE_REMOUNTS + 1);

    overlay.hide();
    overlay.show();
    pages[pages.length - 1]!.crash();
    expect(deps.mount).toHaveBeenCalledTimes(MAX_LOCK_PAGE_REMOUNTS + 3);
  });

  test('a lock page that dies after unlock is not remounted', () => {
    const { deps, lockPage } = makeDeps();
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.hide();
    lockPage.crash();
    expect(deps.mount).toHaveBeenCalledTimes(1);
    expect(overlay.isVisible()).toBe(false);
  });
});
