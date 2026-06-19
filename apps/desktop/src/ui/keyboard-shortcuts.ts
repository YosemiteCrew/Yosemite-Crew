'use strict';

import type { WebContents } from 'electron';

export interface ShortcutDef {
  accelerator: string;
  id: string;
  label: string;
  description: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  {
    accelerator: 'CommandOrControl+K',
    id: 'open-palette',
    label: 'Command Palette',
    description: 'Open command palette',
  },
  {
    accelerator: 'CommandOrControl+P',
    id: 'open-palette',
    label: 'Quick Switch',
    description: 'Quick switch between recent items',
  },
  {
    accelerator: 'CommandOrControl+Shift+N',
    id: 'new-patient',
    label: 'New patient',
    description: 'Create a new patient record',
  },
  {
    accelerator: 'CommandOrControl+Shift+A',
    id: 'appointments',
    label: 'Appointments',
    description: 'Go to appointments',
  },
  {
    accelerator: 'CommandOrControl+Shift+S',
    id: 'search',
    label: 'Search patients',
    description: 'Search for patients',
  },
  {
    accelerator: 'CommandOrControl+Shift+E',
    id: 'check-in',
    label: 'Check in patient',
    description: 'Walk-in check-in',
  },
  {
    accelerator: 'CommandOrControl+Shift+I',
    id: 'inbox',
    label: 'Inbox',
    description: 'Open inbox',
  },
  {
    accelerator: 'CommandOrControl+Shift+B',
    id: 'billing',
    label: 'Billing',
    description: 'Go to billing',
  },
  {
    accelerator: 'CommandOrControl+Shift+T',
    id: 'new-appointment',
    label: 'New appointment',
    description: 'Book a new appointment',
  },
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
