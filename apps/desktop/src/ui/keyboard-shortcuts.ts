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

export const SHORTCUTS: ShortcutDef[] = [
  sc('CommandOrControl+K', 'open-palette', 'Command Palette', 'Open command palette'),
  sc('CommandOrControl+P', 'open-palette', 'Quick Switch', 'Quick switch between recent items'),
  sc('CommandOrControl+Shift+N', 'new-patient', 'New patient', 'Create a new patient record'),
  sc('CommandOrControl+Shift+A', 'appointments', 'Appointments', 'Go to appointments'),
  sc('CommandOrControl+Shift+S', 'search', 'Search patients', 'Search for patients'),
  sc('CommandOrControl+Shift+E', 'check-in', 'Check in patient', 'Walk-in check-in'),
  sc('CommandOrControl+Shift+I', 'inbox', 'Inbox', 'Open inbox'),
  sc('CommandOrControl+Shift+B', 'billing', 'Billing', 'Go to billing'),
  sc('CommandOrControl+Shift+T', 'new-appointment', 'New appointment', 'Book a new appointment'),
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
  logger: {
    debug: (event: string, data?: unknown) => void;
    warn: (event: string, data?: unknown) => void;
  };
}

export interface KeyboardShortcutManager {
  register: () => void;
  unregister: () => void;
  getRegistered: () => ShortcutId[];
}

export const createKeyboardShortcutManager = (
  deps: ShortcutHandlerDeps
): KeyboardShortcutManager => {
  const registered: ShortcutId[] = [];

  const register = (): void => {
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

  return { register, unregister, getRegistered };
};
