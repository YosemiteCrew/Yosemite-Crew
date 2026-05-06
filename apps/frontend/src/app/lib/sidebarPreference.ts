export const SIDEBAR_COLLAPSED_KEY = 'yc_sidebar_collapsed';

export const isSidebarCollapsedByDefault = (): boolean => {
  try {
    const stored = globalThis.window?.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return stored == null ? true : stored === '1';
  } catch {
    return true;
  }
};

export const setSidebarCollapsedPreference = (collapsed: boolean): void => {
  try {
    globalThis.window?.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore storage failures. The sidebar still falls back to collapsed.
  }
};

export const defaultSidebarToCollapsed = (): void => {
  setSidebarCollapsedPreference(true);
};
