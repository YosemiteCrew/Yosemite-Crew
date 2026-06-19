'use strict';

export interface LoginItemSettings {
  openAtLogin: boolean;
  openAsHidden?: boolean;
}

export interface DockMenuItem {
  id: string;
  label: string;
  click: () => void;
}

export interface NotificationActionCategory {
  id: string;
  actions: Array<{ id: string; title: string }>;
}

export const normalizeLoginItemSettings = (enabled: boolean): LoginItemSettings => ({
  openAtLogin: enabled,
  openAsHidden: enabled,
});

export const createDockMenuTemplate = (deps: {
  show: () => void;
  checkForUpdates: () => void;
  newWindow?: () => void;
}): DockMenuItem[] => [
  { id: 'show', label: 'Show Yosemite Crew PIMS', click: deps.show },
  {
    id: 'check-for-updates',
    label: 'Check for Updates...',
    click: deps.checkForUpdates,
  },
  ...(deps.newWindow ? [{ id: 'new-window', label: 'New Window', click: deps.newWindow }] : []),
];

export const notificationActionCategories = (): NotificationActionCategory[] => [
  {
    id: 'pims-message',
    actions: [
      { id: 'open', title: 'Open' },
      { id: 'dismiss', title: 'Dismiss' },
    ],
  },
];
