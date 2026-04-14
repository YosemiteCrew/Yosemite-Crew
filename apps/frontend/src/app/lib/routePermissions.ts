import { appRoutes } from '@/app/constants/routes';
import { Permission, PERMISSIONS } from '@/app/lib/permissions';

const ROUTE_ACCESS_OVERRIDES: ReadonlyArray<{ pathPrefix: string; requiredAny: Permission[] }> = [
  {
    pathPrefix: '/appointments/idexx-workspace',
    requiredAny: [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
  },
  {
    pathPrefix: '/integrations',
    requiredAny: [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
  },
];

const normalizePath = (pathname?: string | null) => {
  const value = String(pathname ?? '').trim();
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
};

const matchesPath = (pathname: string, pathPrefix: string) => {
  return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
};

export const hasAnyRequiredPermission = (
  effectivePermissions: string[] | undefined,
  requiredAnyPermissions?: Permission[]
): boolean => {
  if (!requiredAnyPermissions?.length) return true;
  if (!effectivePermissions?.length) return false;

  const permissionSet = new Set(effectivePermissions);
  return requiredAnyPermissions.some((permission) => permissionSet.has(permission));
};

const resolveRequiredAnyPermissionsForPath = (pathname: string): Permission[] | undefined => {
  const override = ROUTE_ACCESS_OVERRIDES.find((rule) => matchesPath(pathname, rule.pathPrefix));
  if (override) {
    return override.requiredAny;
  }

  const route = appRoutes.find((item) => matchesPath(pathname, item.href));
  return route?.requiredAnyPermissions;
};

export const canAccessPathByPermissions = (
  pathname: string,
  effectivePermissions: string[] | undefined
): boolean => {
  const normalizedPath = normalizePath(pathname);
  const requiredAnyPermissions = resolveRequiredAnyPermissionsForPath(normalizedPath);
  return hasAnyRequiredPermission(effectivePermissions, requiredAnyPermissions);
};

export const resolveFirstAccessibleAppRoute = (
  effectivePermissions: string[] | undefined,
  fallbackRoute = '/organization'
): string => {
  const accessibleRoute = appRoutes.find((route) =>
    hasAnyRequiredPermission(effectivePermissions, route.requiredAnyPermissions)
  );

  return accessibleRoute?.href ?? fallbackRoute;
};
