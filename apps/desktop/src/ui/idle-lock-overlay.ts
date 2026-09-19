'use strict';

// Idle-lock overlay presenter. A pure, injectable unit (mirrors pin-window.ts):
// the composition root supplies the real WebContentsView mount/unmount, so the
// show/hide lifecycle stays unit-testable and idempotent. Keeping the state
// machine here means main.ts only owns the Electron view wiring.
//
// While the lock is up it also owns the keyboard and the other windows: the
// lock page holds focus, every other web contents has its input dropped and its
// DevTools closed, and every window besides the one the lock covers is put away
// until unlock.

// The slice of Electron's WebContents the lock uses.
export interface LockContents {
  focus(): void;
  isDestroyed(): boolean;
  on(
    event: 'before-input-event',
    listener: (event: { preventDefault: () => void }) => void
  ): unknown;
  on(event: 'render-process-gone' | 'devtools-opened', listener: () => void): unknown;
  isDevToolsOpened(): boolean;
  closeDevTools(): void;
}

// The slice of Electron's BrowserWindow the lock uses to put a window away.
export interface LockWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isVisible(): boolean;
  hide(): void;
  show(): void;
  showInactive(): void;
  focus(): void;
  restore(): void;
  minimize(): void;
  destroy(): void;
  setOpacity(opacity: number): void;
  on(event: 'show' | 'focus' | 'restore' | 'closed', listener: () => void): unknown;
  once(event: 'restore', listener: () => void): unknown;
}

// The calls that bring a window onto the screen. The lock answers them itself on
// every window it holds.
const BRING_FORWARD = ['show', 'showInactive', 'focus', 'restore'] as const;

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
  // windows, popups, Preferences, the vault), at creation. One on screen or in
  // the Dock when the lock engages is hidden then, one created or shown during
  // the lock is hidden at once, and all of them come back on unlock. One that
  // was never shown stays that way.
  holdWindow: (win: LockWindow) => void;
  // Whether `win` is one the lock is keeping off the screen right now: while
  // the lock is up, that is every window it holds.
  isHiding: (win: LockWindow) => boolean;
  // Close every held window for good, e.g. when the lock ends in a sign-out
  // and there is nothing for them to come back to.
  closeWindows: () => void;
  // Bring the window the lock covers back on screen, lock page and all, if the
  // lock took it out of the Dock (see show). For a click on the app's Dock
  // icon while locked. Returns whether it did.
  uncover: () => boolean;
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
  // The window the lock page covers (the workspace window), if one is open.
  window: () => LockWindow | null;
  // Every web contents the app has, so the lock can close their DevTools.
  allContents: () => LockContents[];
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
  // The windows unlock brings back, and whether each was minimized.
  const stowed = new Map<LockWindow, boolean>();
  // The windows' own restore(), where holdWindow has replaced it.
  const nativeRestore = new WeakMap<LockWindow, () => void>();

  // A hidden window drops out of the taskbar, but on macOS a minimized one
  // keeps its Dock tile.
  const inDock = (win: LockWindow): boolean => process.platform === 'darwin' && win.isMinimized();

  const putAway = (win: LockWindow): void => {
    if (!stowed.has(win)) stowed.set(win, win.isMinimized());
    if (!inDock(win)) {
      win.hide();
      return;
    }
    // Hidden, a minimized window would keep its Dock tile (a snapshot of the
    // page, and its title), and a click on the tile would put it back on
    // screen. It leaves the Dock instead: restored fully transparent, and
    // hidden once it is back, so it is never seen on the way.
    win.setOpacity(0);
    win.once('restore', () => {
      if (visible && stowed.has(win)) win.hide();
      win.setOpacity(1);
    });
    (nativeRestore.get(win) ?? (() => win.restore()))();
  };

  // Put `win` away if it is on screen or in the Dock (a minimized window is not
  // visible). One that is neither was never shown, and is left out of unlock.
  const stow = (win: LockWindow): void => {
    if (!visible || win.isDestroyed()) return;
    if (stowed.has(win) || win.isVisible() || win.isMinimized()) putAway(win);
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
      // DevTools windows are not BrowserWindows, so none of the above holds
      // them: they are closed, and not reopened on unlock.
      for (const contents of deps.allContents()) {
        if (!contents.isDestroyed() && contents.isDevToolsOpened()) contents.closeDevTools();
      }
      // The window under the lock page, minimized, would keep the page under
      // the lock in its Dock tile: it leaves the Dock too (see uncover).
      const covered = deps.window();
      if (covered && !covered.isDestroyed() && inDock(covered)) putAway(covered);
      mountLockPage();
    },
    hide: (): void => {
      if (!visible) return;
      visible = false;
      lockPage = null;
      deps.unmount();
      // The workspace window goes back to the Dock if the lock took it out:
      // focusing the workspace would put it back on screen instead.
      const covered = deps.window();
      const backToDock = covered !== null && stowed.has(covered);
      for (const [win, minimized] of stowed) {
        if (win.isDestroyed()) continue;
        win.setOpacity(1);
        win.showInactive();
        if (minimized) win.minimize();
      }
      stowed.clear();
      if (!backToDock) focusIfAlive(deps.workspace());
    },
    isVisible: (): boolean => visible,
    // lockPage is only set while the lock is up, so this is a no-op otherwise.
    refocus: (): void => focusIfAlive(lockPage),
    holdInput: (contents: LockContents): void => {
      contents.on('before-input-event', (event) => {
        if (visible && contents !== lockPage) event.preventDefault();
      });
      contents.on('devtools-opened', () => {
        if (visible) contents.closeDevTools();
      });
    },
    holdWindow: (win: LockWindow): void => {
      windows.add(win);
      win.on('closed', () => {
        windows.delete(win);
        stowed.delete(win);
      });
      // The app bringing it forward mid-lock (show(), focus() and the like)
      // leaves it off the screen, and marks it to come back on unlock. The call
      // is answered here, not by undoing it on the window's 'show' or 'focus'
      // event: macOS does not send those while the display sleeps.
      nativeRestore.set(win, win.restore.bind(win));
      for (const name of BRING_FORWARD) {
        const bringForward = win[name].bind(win);
        win[name] = (): void => {
          if (!visible) bringForward();
          else if (!win.isDestroyed()) putAway(win);
        };
      }
      // Whatever else brings it back mid-lock (the user restoring it from the
      // Dock, say), it goes straight back.
      const restow = (): void => stow(win);
      win.on('show', restow);
      win.on('focus', restow);
      win.on('restore', restow);
      // This runs from browser-window-created, before the new window's own
      // constructor has shown it, so a window opened mid-lock is put away once
      // that constructor (and the code that called it) is done.
      queueMicrotask(restow);
    },
    isHiding: (win: LockWindow): boolean => visible && windows.has(win),
    closeWindows: (): void => {
      // destroy(), not close(): a page's beforeunload cannot keep one open.
      for (const win of windows) if (!win.isDestroyed()) win.destroy();
      windows.clear();
      stowed.clear();
    },
    uncover: (): boolean => {
      const covered = deps.window();
      if (!visible || !covered || covered.isDestroyed() || !stowed.delete(covered)) return false;
      covered.setOpacity(1);
      covered.show();
      return true;
    },
  };
};
