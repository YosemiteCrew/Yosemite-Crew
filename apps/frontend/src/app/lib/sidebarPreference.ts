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

export const setSidebarCollapsedPreference = (collapsed: boolean): void => {
  setStorageItem('local', SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
};

// Clear any stored preference so the viewport-aware default applies again.
// Called on auth transitions so a returning user lands on the expanded desktop
// shell instead of a pinned collapsed rail.
export const resetSidebarPreference = (): void => {
  removeStorageItem('local', SIDEBAR_COLLAPSED_KEY);
};

/**
 * @deprecated Back-compat alias for {@link resetSidebarPreference}. It used to
 * pin the sidebar collapsed after auth; it now clears the stored preference so
 * the viewport-aware default applies.
 *
 * Only `features/auth/pages/SignIn` and `SignUp` still call it — those pages are
 * separately owned and deliberately untouched by this PR, which is the sole
 * reason the alias exists. Every other caller has migrated to
 * {@link resetSidebarPreference}. Delete this alias once those two pages move
 * over; nothing else should start using it.
 */
export const defaultSidebarToCollapsed = resetSidebarPreference;
