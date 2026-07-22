import { appRoutes } from '@/app/constants/routes';
import { Permission, PERMISSIONS, ROLE_PERMISSIONS, RoleCode } from '@/app/lib/permissions';

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

type MembershipPermissionSource = {
  roleCode?: string | null;
  effectivePermissions?: string[] | null;
  extraPermissions?: string[] | null;
  revokedPermissions?: string[] | null;
};

/**
 * Effective permissions for a membership, recomputed from its role instead of
 * trusting the stored snapshot alone. Memberships persist effectivePermissions
 * at write time, so a row written before a permission joined the role table
 * keeps that stale set indefinitely, which silently greys out nav entries the
 * role does own. Recomputing baseline + extras - revocations mirrors the
 * backend formula, so drifted rows heal without a data migration while explicit
 * revocations are still honoured. An unrecognised role falls back to the stored
 * array so an unknown role never gains permissions it was never granted.
 */
export const resolveMembershipPermissions = (
  membership?: MembershipPermissionSource | null
): string[] => {
  const baseline = ROLE_PERMISSIONS[membership?.roleCode as RoleCode];
  // Nothing to derive from, so the stored snapshot is the only signal left.
  if (!baseline) return membership?.effectivePermissions ?? [];

  // Deliberately excludes the stored snapshot. Dropping a permission from the
  // role table leaves it in every previously written snapshot without ever
  // appearing in revokedPermissions, so folding those in would re-grant access
  // the API now denies. Matching the backend formula exactly keeps the two in
  // step in both directions.
  const granted = new Set<string>([...baseline, ...(membership?.extraPermissions ?? [])]);
  for (const permission of membership?.revokedPermissions ?? []) granted.delete(permission);
  return [...granted];
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
