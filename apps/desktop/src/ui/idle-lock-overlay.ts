'use strict';

// Idle-lock overlay presenter. A pure, injectable unit (mirrors pin-window.ts):
// the composition root supplies the real WebContentsView mount/unmount, so the
// show/hide lifecycle stays unit-testable and idempotent. Keeping the state
// machine here means main.ts only owns the Electron view wiring.

export interface IdleLockOverlay {
  // Mount the lock overlay over the workspace. No-op if already visible.
  show: () => void;
  // Remove the lock overlay. No-op if not visible.
  hide: () => void;
  isVisible: () => boolean;
}

export interface IdleLockOverlayDeps {
  // Create + layer + load the overlay view on top of the workspace.
  mount: () => void;
  // Remove + destroy the overlay view.
  unmount: () => void;
}

export const createIdleLockOverlay = (deps: IdleLockOverlayDeps): IdleLockOverlay => {
  let visible = false;
  return {
    show: (): void => {
      if (visible) return;
      visible = true;
      deps.mount();
    },
    hide: (): void => {
      if (!visible) return;
      visible = false;
      deps.unmount();
    },
    isVisible: (): boolean => visible,
  };
};
