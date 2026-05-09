import type { UserProfile } from '@/app/features/users/types/profile';
import {
  defaultOpenScreenToRoute,
  normalizePmsPreferences,
} from '@/app/features/settings/utils/pmsPreferences';
import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';

const DEFAULT_OPEN_SCREEN_STORAGE_KEY = 'yc_default_open_screen';

export type DefaultOpenScreenRoute = '/dashboard' | '/appointments';

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
  const saved = getStorageItem('local', DEFAULT_OPEN_SCREEN_STORAGE_KEY);
  return isValidRoute(saved) ? saved : null;
};

export const setSavedDefaultOpenScreenRoute = (route: DefaultOpenScreenRoute | null): boolean => {
  if (route != null && !isValidRoute(route)) return false;

  const didPersist =
    route == null
      ? removeStorageItem('local', DEFAULT_OPEN_SCREEN_STORAGE_KEY)
      : setStorageItem('local', DEFAULT_OPEN_SCREEN_STORAGE_KEY, route);

  if (!didPersist || !globalThis.window) return false;

  globalThis.window.dispatchEvent(
    new CustomEvent('yc:default-open-screen-changed', {
      detail: { route },
    })
  );
  return true;
};

export const resolveDefaultOpenScreenRoute = (role?: string | null): DefaultOpenScreenRoute => {
  const saved = getSavedDefaultOpenScreenRoute();
  if (saved) return saved;
  return getRoleDefaultOpenScreenRoute(role);
};

export const resolveDefaultOpenScreenRouteForProfile = ({
  profile,
  orgType,
  role,
}: {
  profile?: UserProfile | null;
  orgType?: string;
  role?: string | null;
}): DefaultOpenScreenRoute => {
  const configuredDefaultOpenScreen = profile?.personalDetails?.pmsPreferences?.defaultOpenScreen;
  if (!configuredDefaultOpenScreen) {
    return resolveDefaultOpenScreenRoute(role);
  }

  const preferredRoute = defaultOpenScreenToRoute(
    normalizePmsPreferences(profile?.personalDetails?.pmsPreferences, orgType).defaultOpenScreen
  );

  if (preferredRoute === '/dashboard' || preferredRoute === '/appointments') {
    return preferredRoute;
  }

  return resolveDefaultOpenScreenRoute(role);
};
