const DEFAULT_OPEN_SCREEN_STORAGE_KEY = 'yc_default_open_screen';

export type DefaultOpenScreenRoute = '/dashboard' | '/appointments';

const hasWindow = () => typeof window !== 'undefined';

const normalizeRole = (role?: string | null) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

const isOwnerRole = (role?: string | null) => normalizeRole(role) === 'owner';

export const getRoleDefaultOpenScreenRoute = (role?: string | null): DefaultOpenScreenRoute => {
  return isOwnerRole(role) ? '/dashboard' : '/appointments';
};

const isValidRoute = (value?: string | null): value is DefaultOpenScreenRoute => {
  return value === '/dashboard' || value === '/appointments';
};

export const getSavedDefaultOpenScreenRoute = (): DefaultOpenScreenRoute | null => {
  if (!hasWindow()) return null;
  try {
    const saved = window.localStorage.getItem(DEFAULT_OPEN_SCREEN_STORAGE_KEY);
    return isValidRoute(saved) ? saved : null;
  } catch {
    return null;
  }
};

export const setSavedDefaultOpenScreenRoute = (route: DefaultOpenScreenRoute | null): boolean => {
  if (!hasWindow()) return false;
  try {
    if (route == null) {
      window.localStorage.removeItem(DEFAULT_OPEN_SCREEN_STORAGE_KEY);
    } else if (isValidRoute(route)) {
      window.localStorage.setItem(DEFAULT_OPEN_SCREEN_STORAGE_KEY, route);
    } else {
      return false;
    }
    window.dispatchEvent(
      new CustomEvent('yc:default-open-screen-changed', {
        detail: { route },
      })
    );
    return true;
  } catch {
    return false;
  }
};

export const resolveDefaultOpenScreenRoute = (role?: string | null): DefaultOpenScreenRoute => {
  const saved = getSavedDefaultOpenScreenRoute();
  if (saved) return saved;
  return getRoleDefaultOpenScreenRoute(role);
};
