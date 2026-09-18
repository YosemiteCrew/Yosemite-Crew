'use strict';

import type { WebContents } from 'electron';

export interface ShortcutDef {
  accelerator: string;
  id: string;
  label: string;
  description: string;
}

const sc = (accelerator: string, id: string, label: string, description: string): ShortcutDef => ({
  accelerator,
  id,
  label,
  description,
});

// These fire ahead of the application menu, so every accelerator here has to
// stay clear of one: the menu and the tab strip own Mod and Mod+Shift, and the
// app's own actions live in the Mod+Alt namespace. Mod+Alt+I is left alone
// because it is Toggle Developer Tools on macOS.
export const SHORTCUTS: ShortcutDef[] = [
  sc('CommandOrControl+K', 'open-palette', 'Command Palette', 'Open command palette'),
  sc('CommandOrControl+Alt+N', 'new-patient', 'New patient', 'Create a new patient record'),
  sc('CommandOrControl+Alt+A', 'appointments', 'Appointments', 'Go to appointments'),
  sc('CommandOrControl+Alt+S', 'search', 'Search patients', 'Search for patients'),
  sc('CommandOrControl+Alt+E', 'check-in', 'Check in patient', 'Walk-in check-in'),
  sc('CommandOrControl+Alt+M', 'inbox', 'Inbox', 'Open inbox'),
  sc('CommandOrControl+Alt+B', 'billing', 'Billing', 'Go to billing'),
  sc('CommandOrControl+Alt+T', 'new-appointment', 'New appointment', 'Book a new appointment'),
];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

export const shortcutActionUrl: Record<ShortcutId, string | null> = {
  'open-palette': null,
  'new-patient': 'yosemitecrew://patients/new',
  appointments: 'yosemitecrew://appointments',
  search: 'yosemitecrew://patients/find',
  'check-in': 'yosemitecrew://appointments/check-in',
  inbox: 'yosemitecrew://chat',
  billing: 'yosemitecrew://finance',
  'new-appointment': 'yosemitecrew://appointments/new',
};

export interface GlobalShortcut {
  register: (accelerator: string, callback: () => void) => boolean;
  unregister: (accelerator: string) => void;
  unregisterAll: () => void;
}

interface ShortcutHandlerDeps {
  globalShortcut: GlobalShortcut;
  focusedWebContents: () => WebContents | null;
  openPalette: () => void;
  navigate: (url: string) => void;
  onWindowFocus: (cb: () => void) => void;
  onWindowBlur: (cb: () => void) => void;
  hasFocusedWindow: () => boolean;
  // Blur arrives before the focus of the window taking over, so the decision to
  // release the keys is deferred a tick. Injectable so tests need no timers.
  defer?: (cb: () => void) => void;
  logger: {
    debug: (event: string, data?: unknown) => void;
    warn: (event: string, data?: unknown) => void;
  };
}

export interface KeyboardShortcutManager {
  register: () => void;
  unregister: () => void;
  getRegistered: () => ShortcutId[];
  start: () => void;
  stop: () => void;
}

export const createKeyboardShortcutManager = (
  deps: ShortcutHandlerDeps
): KeyboardShortcutManager => {
  const registered: ShortcutId[] = [];

  const register = (): void => {
    // Focus can be handed back while the keys are still held; re-registering
    // would double every entry in `registered` and leak the accelerators.
    if (registered.length > 0) return;

    for (const shortcut of SHORTCUTS) {
      const ok = deps.globalShortcut.register(shortcut.accelerator, () => {
        deps.logger.debug('shortcut_triggered', {
          id: shortcut.id,
          accelerator: shortcut.accelerator,
        });

        if (shortcut.id === 'open-palette') {
          deps.openPalette();
          return;
        }

        const url = shortcutActionUrl[shortcut.id];
        if (url) {
          deps.navigate(url);
          return;
        }

        const wc = deps.focusedWebContents();
        if (wc && !wc.isDestroyed()) {
          wc.send('yc:shortcut', shortcut.id);
        }
      });

      if (ok) {
        registered.push(shortcut.id);
        deps.logger.debug('shortcut_registered', { id: shortcut.id });
      } else {
        deps.logger.warn('shortcut_register_failed', {
          id: shortcut.id,
          accelerator: shortcut.accelerator,
        });
      }
    }
  };

  const unregister = (): void => {
    for (const id of registered) {
      const shortcut = SHORTCUTS.find((s) => s.id === id);
      if (shortcut) {
        deps.globalShortcut.unregister(shortcut.accelerator);
      }
    }
    registered.length = 0;
  };

  const getRegistered = (): ShortcutId[] => [...registered];

  // The keys belong to this app, not to the machine: they are taken while one of
  // our windows has focus and handed straight back when it loses it.
  const start = (): void => {
    const defer = deps.defer ?? ((cb: () => void) => setImmediate(cb));
    deps.onWindowFocus(register);
    deps.onWindowBlur(() => {
      defer(() => {
        if (!deps.hasFocusedWindow()) unregister();
      });
    });
    if (deps.hasFocusedWindow()) register();
  };

  return { register, unregister, getRegistered, start, stop: unregister };
};
