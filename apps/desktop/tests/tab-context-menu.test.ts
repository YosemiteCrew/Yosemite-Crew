import { buildTabContextMenu, type TabContextMenuState } from '../src/ui/tab-context-menu';

const state = (
  tabs: Array<{ id: string; pinned?: boolean }>,
  closedStack: unknown[] = []
): TabContextMenuState => ({ tabs, closedStack });

const three = state([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

const item = (menu: ReturnType<typeof buildTabContextMenu>, id: string) => {
  const found = (menu || []).find((entry) => entry.id === id);
  if (!found) throw new Error(`no ${id} item in ${JSON.stringify(menu)}`);
  return found;
};

describe('buildTabContextMenu', () => {
  test('a tab that is no longer open has no menu', () => {
    expect(buildTabContextMenu(three, 'gone')).toBeNull();
  });

  test('an unpinned tab is offered Pin, and a pinned one Unpin', () => {
    const unpinned = buildTabContextMenu(state([{ id: 'a', pinned: false }]), 'a');
    expect(unpinned?.map((entry) => entry.id)).toContain('pin');
    expect(unpinned?.map((entry) => entry.id)).not.toContain('unpin');

    const pinned = buildTabContextMenu(state([{ id: 'a', pinned: true }]), 'a');
    expect(pinned?.map((entry) => entry.id)).toContain('unpin');
    expect(pinned?.map((entry) => entry.id)).not.toContain('pin');
  });

  test('every action carries a label a menu can render', () => {
    for (const entry of buildTabContextMenu(three, 'a') || []) {
      if (entry.separator) continue;
      expect(entry.label && entry.label.length).toBeGreaterThan(0);
    }
  });

  test('Close others is unreachable for the only tab and reachable beside another', () => {
    expect(item(buildTabContextMenu(state([{ id: 'a' }]), 'a'), 'close-others').enabled).toBe(
      false
    );
    expect(item(buildTabContextMenu(three, 'a'), 'close-others').enabled).toBe(true);
  });

  test('Close tabs to the right is unreachable for the last tab only', () => {
    expect(item(buildTabContextMenu(three, 'a'), 'close-right').enabled).toBe(true);
    expect(item(buildTabContextMenu(three, 'b'), 'close-right').enabled).toBe(true);
    expect(item(buildTabContextMenu(three, 'c'), 'close-right').enabled).toBe(false);
  });

  test('Reopen closed tab follows whether anything has been closed', () => {
    expect(item(buildTabContextMenu(three, 'a'), 'reopen-closed').enabled).toBe(false);
    const withHistory = state([{ id: 'a' }], [{ id: 'z' }]);
    expect(item(buildTabContextMenu(withHistory, 'a'), 'reopen-closed').enabled).toBe(true);
  });

  test('a state with no closedStack at all reads as nothing to reopen', () => {
    const menu = buildTabContextMenu({ tabs: [{ id: 'a' }] }, 'a');
    expect(item(menu, 'reopen-closed').enabled).toBe(false);
  });

  test('the destructive actions are separated from the rest', () => {
    const menu = buildTabContextMenu(three, 'b') || [];
    const separators = menu.filter((entry) => entry.separator);
    expect(separators).toHaveLength(2);
    const closeAt = menu.findIndex((entry) => entry.id === 'close');
    const firstSeparatorAt = menu.findIndex((entry) => entry.separator);
    expect(firstSeparatorAt).toBeLessThan(closeAt);
  });

  test('a separator carries no action, so nothing can be clicked into a no-op', () => {
    for (const entry of buildTabContextMenu(three, 'a') || []) {
      if (entry.separator) expect(entry.id).toBeUndefined();
      else expect(entry.id).toBeDefined();
    }
  });
});
