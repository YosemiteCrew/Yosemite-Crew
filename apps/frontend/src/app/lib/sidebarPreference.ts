import { getStorageItem, setStorageItem } from '@/app/lib/browserStorage';

export const SIDEBAR_COLLAPSED_KEY = 'yc_sidebar_collapsed';

export const isSidebarCollapsedByDefault = (): boolean => {
  const stored = getStorageItem('local', SIDEBAR_COLLAPSED_KEY);
  return stored == null ? true : stored === '1';
};

export const setSidebarCollapsedPreference = (collapsed: boolean): void => {
  setStorageItem('local', SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
};

export const defaultSidebarToCollapsed = (): void => {
  setSidebarCollapsedPreference(true);
};
