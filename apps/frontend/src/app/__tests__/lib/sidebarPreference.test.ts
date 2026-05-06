import {
  defaultSidebarToCollapsed,
  isSidebarCollapsedByDefault,
  setSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_KEY,
} from '@/app/lib/sidebarPreference';

describe('sidebarPreference', () => {
  beforeEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('defaults to collapsed when no preference exists', () => {
    expect(isSidebarCollapsedByDefault()).toBe(true);
  });

  it('reads expanded and collapsed persisted preferences', () => {
    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '0');
    expect(isSidebarCollapsedByDefault()).toBe(false);

    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    expect(isSidebarCollapsedByDefault()).toBe(true);
  });

  it('writes the collapsed preference', () => {
    setSidebarCollapsedPreference(false);
    expect(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('0');

    defaultSidebarToCollapsed();
    expect(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
  });
});
