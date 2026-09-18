'use strict';

import { createIdleLockOverlay, type LockContents } from '../src/ui/idle-lock-overlay';

type InputListener = (event: { preventDefault: () => void }) => void;

// A web contents stand-in: records focus() and lets a test fire
// before-input-event the way Electron does for a key press.
const makeContents = () => {
  const listeners: InputListener[] = [];
  let destroyed = false;
  const contents = {
    focus: jest.fn(),
    isDestroyed: () => destroyed,
    on: jest.fn((_event: 'before-input-event', listener: InputListener) => {
      listeners.push(listener);
    }),
    destroy: () => {
      destroyed = true;
    },
    // Returns whether the key press was dropped.
    press: (): boolean => {
      const event = { preventDefault: jest.fn() };
      for (const listener of listeners) listener(event);
      return event.preventDefault.mock.calls.length > 0;
    },
  };
  return contents satisfies LockContents;
};

const makeDeps = () => {
  const lockPage = makeContents();
  const tab = makeContents();
  return {
    lockPage,
    tab,
    deps: {
      mount: jest.fn((): LockContents | null => lockPage),
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

  test('show() with no window to cover focuses nothing', () => {
    const { deps, lockPage, tab } = makeDeps();
    deps.mount.mockReturnValueOnce(null);
    const overlay = createIdleLockOverlay(deps);
    overlay.show();
    overlay.refocus();
    expect(lockPage.focus).not.toHaveBeenCalled();
    expect(tab.focus).not.toHaveBeenCalled();
    expect(overlay.isVisible()).toBe(true);
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
