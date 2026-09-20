'use strict';

// Idle-lock overlay presenter. A pure, injectable unit (mirrors pin-window.ts):
// the composition root supplies the real WebContentsView mount/unmount, so the
// show/hide lifecycle stays unit-testable and idempotent. Keeping the state
// machine here means main.ts only owns the Electron view wiring.
//
// While the lock is up it also owns the keyboard: the lock page holds focus,
// and every other web contents has its input dropped until unlock.

// The slice of Electron's WebContents the lock uses.
export interface LockContents {
  focus: () => void;
  isDestroyed: () => boolean;
  on: (
    event: 'before-input-event',
    listener: (event: { preventDefault: () => void }) => void
  ) => unknown;
}

export interface IdleLockOverlay {
  // Mount the lock overlay over the workspace and focus it. No-op if already visible.
  show: () => void;
  // Remove the lock overlay and focus the workspace again. No-op if not visible.
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
}

export interface IdleLockOverlayDeps {
  // Create + layer + load the overlay view on top of the workspace. Returns the
  // lock page's web contents, or null when there is no window to cover.
  mount: () => LockContents | null;
  // Remove + destroy the overlay view.
  unmount: () => void;
  // What takes focus back once the lock comes down (the active tab).
  workspace: () => LockContents | null;
}

const focusIfAlive = (target: LockContents | null): void => {
  if (target && !target.isDestroyed()) target.focus();
};

export const createIdleLockOverlay = (deps: IdleLockOverlayDeps): IdleLockOverlay => {
  let visible = false;
  let lockPage: LockContents | null = null;
  return {
    show: (): void => {
      if (visible) return;
      visible = true;
      lockPage = deps.mount();
      focusIfAlive(lockPage);
    },
    hide: (): void => {
      if (!visible) return;
      visible = false;
      lockPage = null;
      deps.unmount();
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
  };
};
