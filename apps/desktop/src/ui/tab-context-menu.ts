'use strict';

/**
 * What the tab context menu can do. The main process only decides which of
 * these to offer and whether each is reachable; the tab bar performs them
 * through the tab IPC it already uses, so the menu adds no second way to
 * mutate tab state.
 */
export type TabContextAction =
  'duplicate' | 'pin' | 'unpin' | 'close' | 'close-others' | 'close-right' | 'reopen-closed';

/**
 * Only what the menu actually decides on, so the tab-IPC service contract does
 * not have to hand the whole of a TabManagerState across - a TabManagerState
 * satisfies this structurally.
 */
export interface TabContextMenuState {
  tabs: Array<{ id: string; pinned?: boolean }>;
  closedStack?: readonly unknown[];
}

export interface TabContextMenuItem {
  /** A separator carries no id, label or enabled flag. */
  separator?: true;
  id?: TabContextAction;
  label?: string;
  enabled?: boolean;
}

/**
 * The menu for one tab, or null when the tab is gone - a context menu is
 * requested from a click, and the tab it was clicked on can be closed by a
 * background update between the click and this call.
 *
 * Items that cannot do anything are disabled rather than hidden: a menu whose
 * entries move about between right-clicks is harder to use than one whose
 * entries grey out, and hiding them would make "Close tabs to the right"
 * ambiguous with a build that never had it.
 */
export const buildTabContextMenu = (
  state: TabContextMenuState,
  tabId: string
): TabContextMenuItem[] | null => {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return null;
  const tab = state.tabs[index];
  if (!tab) return null;

  return [
    { id: 'duplicate', label: 'Duplicate', enabled: true },
    tab.pinned
      ? { id: 'unpin', label: 'Unpin tab', enabled: true }
      : { id: 'pin', label: 'Pin tab', enabled: true },
    { separator: true },
    { id: 'close', label: 'Close tab', enabled: true },
    { id: 'close-others', label: 'Close others', enabled: state.tabs.length > 1 },
    {
      id: 'close-right',
      label: 'Close tabs to the right',
      enabled: index < state.tabs.length - 1,
    },
    { separator: true },
    {
      id: 'reopen-closed',
      label: 'Reopen closed tab',
      enabled: (state.closedStack?.length ?? 0) > 0,
    },
  ];
};
