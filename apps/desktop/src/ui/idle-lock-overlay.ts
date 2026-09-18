'use strict';

// Idle-lock overlay presenter. A pure, injectable unit (mirrors pin-window.ts):
// the composition root supplies the real WebContentsView mount/unmount, so the
// show/hide lifecycle stays unit-testable and idempotent. Keeping the state
// machine here means main.ts only owns the Electron view wiring.
//
// While the lock is up it also owns the keyboard and the other windows: the
// lock page holds focus, every other web contents has its input dropped, and
// every window besides the one the lock covers is put away until unlock.

// The slice of Electron's WebContents the lock uses.
export interface LockContents {
  focus(): void;
  isDestroyed(): boolean;
  on(
    event: 'before-input-event',
    listener: (event: { preventDefault: () => void }) => void
  ): unknown;
  on(event: 'render-process-gone', listener: () => void): unknown;
}

// The slice of Electron's BrowserWindow the lock uses to put a window away.
export interface LockWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  hide(): void;
  showInactive(): void;
  minimize(): void;
  destroy(): void;
  on(event: 'show' | 'focus' | 'restore' | 'closed', listener: () => void): unknown;
}

export interface IdleLockOverlay {
  // Mount the lock overlay over the workspace and focus it. No-op if already visible.
  show: () => void;
  // Remove the lock overlay, bring back the windows it put away, and focus the
  // workspace again. No-op if not visible.
  hide: () => void;
  isVisible: () => boolean;
  // Put focus back on the lock page, e.g. after a relayout re-parents its view.
  // No-op while unlocked.
  refocus: () => void;
  // Drop keyboard input to `contents` while the lock is up (preventDefault on
  // before-input-event also stops menu accelerators aimed at it). Registered on
  // every web contents at creation, so a tab opened or switched to mid-lock is
  // held as well. The lock page is the one exception.
  holdInput: (contents: LockContents) => void;
  // Keep `win` hidden while the lock is up: registered on every window other
  // than the one the lock covers (pinned pages, patient and detached-tab
  // windows, popups, Preferences, the vault), at creation. One open when the
  // lock engages is hidden then, one created or shown during the lock is
  // hidden at once, and all of them come back on unlock.
  holdWindow: (win: LockWindow) => void;
  // Whether `win` is one the lock is keeping hidden right now.
  isHiding: (win: LockWindow) => boolean;
  // Close every held window for good, e.g. when the lock ends in a sign-out
  // and there is nothing for them to come back to.
  closeWindows: () => void;
}

export interface IdleLockOverlayDeps {
  // Create + layer + load the overlay view on top of the workspace, or keep it
  // ready for the next window when none is open. Returns the lock page's web
  // contents.
  mount: () => LockContents;
  // Remove + destroy the overlay view.
  unmount: () => void;
  // What takes focus back once the lock comes down (the active tab).
  workspace: () => LockContents | null;
}

// A lock page whose renderer dies is replaced, a few times per lock: a page
// that keeps crashing must not turn into a remount loop.
export const MAX_LOCK_PAGE_REMOUNTS = 3;

const focusIfAlive = (target: LockContents | null): void => {
  if (target && !target.isDestroyed()) target.focus();
};

export const createIdleLockOverlay = (deps: IdleLockOverlayDeps): IdleLockOverlay => {
  let visible = false;
  let lockPage: LockContents | null = null;
  let remounts = 0;
  const windows = new Set<LockWindow>();
  // The windows the lock has put away, and whether each was minimized.
  const stowed = new Map<LockWindow, boolean>();

  const stow = (win: LockWindow): void => {
    if (!visible || win.isDestroyed()) return;
    if (!stowed.has(win)) stowed.set(win, win.isMinimized());
    win.hide();
  };

  const mountLockPage = (): void => {
    const page = deps.mount();
    lockPage = page;
    page.on('render-process-gone', () => {
      if (lockPage !== page || remounts >= MAX_LOCK_PAGE_REMOUNTS) return;
      remounts++;
      lockPage = null;
      deps.unmount();
      mountLockPage();
    });
    focusIfAlive(page);
  };

  return {
    show: (): void => {
      if (visible) return;
      visible = true;
      remounts = 0;
      for (const win of windows) stow(win);
      mountLockPage();
    },
    hide: (): void => {
      if (!visible) return;
      visible = false;
      lockPage = null;
      deps.unmount();
      for (const [win, minimized] of stowed) {
        if (win.isDestroyed()) continue;
        win.showInactive();
        if (minimized) win.minimize();
      }
      stowed.clear();
      focusIfAlive(deps.workspace());
    },
    isVisible: (): boolean => visible,
    // lockPage is only set while the lock is up, so this is a no-op otherwise.
    refocus: (): void => focusIfAlive(lockPage),
    holdInput: (contents: LockContents): void => {
      contents.on('before-input-event', (event) => {
        if (visible && contents !== lockPage) event.preventDefault();
      });
    },
    holdWindow: (win: LockWindow): void => {
      windows.add(win);
      win.on('closed', () => {
        windows.delete(win);
        stowed.delete(win);
      });
      // Whatever brings it back mid-lock (a show() call, picking it from the
      // Window menu, restoring it from the Dock), it goes straight back.
      const restow = (): void => stow(win);
      win.on('show', restow);
      win.on('focus', restow);
      win.on('restore', restow);
      // This runs from browser-window-created, before the new window's own
      // constructor has shown it, so a window opened mid-lock is put away once
      // that constructor (and the code that called it) is done.
      queueMicrotask(restow);
    },
    isHiding: (win: LockWindow): boolean => stowed.has(win),
    closeWindows: (): void => {
      // destroy(), not close(): a page's beforeunload cannot keep one open.
      for (const win of windows) if (!win.isDestroyed()) win.destroy();
      windows.clear();
      stowed.clear();
    },
  };
};
