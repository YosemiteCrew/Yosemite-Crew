import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';

export const SIDEBAR_COLLAPSED_KEY = 'yc_sidebar_collapsed';

// The design breakpoint contract: the expanded 224px sidebar is the desktop
// default (>=1280px); tablet widths start on the collapsed 76px icon rail.
export const SIDEBAR_DESKTOP_MIN_WIDTH = 1280;

export const isSidebarCollapsedByDefault = (): boolean => {
  const stored = getStorageItem('local', SIDEBAR_COLLAPSED_KEY);
  if (stored != null) return stored === '1';
  // No stored preference: follow the viewport — expanded on desktop, collapsed
  // to the icon rail on tablet.
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth < SIDEBAR_DESKTOP_MIN_WIDTH;
  }
  return false;
};

// Fired after this tab changes the preference. The browser's own `storage`
// event only reaches other tabs, so mounted sidebars in this one listen for this.
export const SIDEBAR_PREFERENCE_EVENT = 'yc-sidebar-preference';

const notifySidebarPreferenceChange = () => {
  globalThis.window?.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
};

export const setSidebarCollapsedPreference = (collapsed: boolean): void => {
  setStorageItem('local', SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  notifySidebarPreferenceChange();
};

// Clear any stored preference so the viewport-aware default applies again.
// Called on auth transitions so a returning user lands on the expanded desktop
// shell instead of a pinned collapsed rail.
export const resetSidebarPreference = (): void => {
  removeStorageItem('local', SIDEBAR_COLLAPSED_KEY);
  notifySidebarPreferenceChange();
};

const PREFERENCE_CHANGE_EVENTS = [SIDEBAR_PREFERENCE_EVENT, 'storage', 'resize'];

/**
 * Subscribes to everything that can change `isSidebarCollapsedByDefault()`: a
 * write in this tab, a write in another tab, and a resize (the viewport default
 * applies while nothing is stored). Shaped for `useSyncExternalStore`, which
 * only subscribes in the browser.
 */
export const subscribeSidebarPreference = (onChange: () => void): (() => void) => {
  for (const name of PREFERENCE_CHANGE_EVENTS) globalThis.window.addEventListener(name, onChange);
  return () => {
    for (const name of PREFERENCE_CHANGE_EVENTS) {
      globalThis.window.removeEventListener(name, onChange);
    }
  };
};
