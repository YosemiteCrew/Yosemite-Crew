'use strict';

export interface TrayMenuDeps {
  isVisible: () => boolean;
  show: () => void;
  hide: () => void;
  checkForUpdates: () => void;
  quit: () => void;
  quickActions?: TrayQuickAction[];
}

export interface TrayQuickAction {
  id: string;
  label: string;
  click: () => void;
}

export interface TrayMenuItem {
  id: string;
  label: string;
  type?: 'normal' | 'separator';
  click?: () => void;
}

export const createTrayMenuTemplate = (deps: TrayMenuDeps): TrayMenuItem[] => {
  const items: TrayMenuItem[] = [
    {
      id: 'show-hide',
      label: deps.isVisible() ? 'Hide Yosemite Crew PIMS' : 'Show Yosemite Crew PIMS',
      click: () => {
        if (deps.isVisible()) {
          deps.hide();
          return;
        }
        deps.show();
      },
    },
  ];

  if (deps.quickActions && deps.quickActions.length > 0) {
    items.push({ id: 'quick-actions-sep', label: '', type: 'separator' });
    for (const action of deps.quickActions) {
      items.push({
        id: `quick-${action.id}`,
        label: action.label,
        click: action.click,
      });
    }
  }

  items.push(
    { id: 'actions-sep', label: '', type: 'separator' },
    {
      id: 'check-for-updates',
      label: 'Check for Updates...',
      click: deps.checkForUpdates,
    },
    { id: 'quit-sep', label: '', type: 'separator' },
    {
      id: 'quit',
      label: 'Quit Yosemite Crew PIMS',
      click: deps.quit,
    }
  );

  return items;
};
