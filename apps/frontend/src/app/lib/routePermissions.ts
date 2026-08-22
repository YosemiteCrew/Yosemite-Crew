import { appRoutes } from '@/app/constants/routes';
import { Permission, PERMISSIONS, ROLE_PERMISSIONS, RoleCode } from '@/app/lib/permissions';

const ROUTE_ACCESS_OVERRIDES: ReadonlyArray<{
  pathPrefix: string;
  requiredAny?: Permission[];
  requiredAll?: Permission[];
}> = [
  {
    // The workspace needs both grants: it loads lab results and orders from
    // routes requiring labs:view:any, and reads the integration status from
    // routes requiring integrations:view:any, so holding one without the other
    // renders it empty. Role baselines always pair them, but extras and
    // revocations can separate the two on a custom membership.
    pathPrefix: '/appointments/idexx-workspace',
    requiredAll: [PERMISSIONS.LABS_VIEW_ANY, PERMISSIONS.INTEGRATIONS_VIEW_ANY],
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

export const hasAllRequiredPermissions = (
  effectivePermissions: string[] | undefined,
  requiredAllPermissions?: Permission[]
): boolean => {
  if (!requiredAllPermissions?.length) return true;
  if (!effectivePermissions?.length) return false;

  const permissionSet = new Set(effectivePermissions);
  return requiredAllPermissions.every((permission) => permissionSet.has(permission));
};

type MembershipPermissionSource = {
  roleCode?: string | null;
  active?: boolean | null;
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
  // The backend only resolves permissions for an active mapping and treats a
  // missing flag as active, so an explicitly deactivated membership grants
  // nothing here either.
  if (membership?.active === false) return [];

  const extras = membership?.extraPermissions ?? [];
  const roleCode = membership?.roleCode;
  // No role at all: the backend returns the extras verbatim, without applying
  // revocations. A role that is merely unrecognised is different - it falls
  // through to an empty baseline below and still honours revocations.
  if (!roleCode) return [...new Set(extras)];

  // The stored effectivePermissions snapshot is deliberately never consulted.
  // It is written at save time, so dropping a permission from the role table
  // leaves it behind in every earlier snapshot without ever appearing in
  // revokedPermissions; folding those in would re-grant access the API now
  // denies. Deriving purely from role plus extras minus revocations is exactly
  // what the backend recomputes on every request.
  const baseline = ROLE_PERMISSIONS[roleCode as RoleCode] ?? [];
  const granted = new Set<string>([...baseline, ...extras]);
  for (const permission of membership?.revokedPermissions ?? []) granted.delete(permission);
  return [...granted];
};

const resolveRouteAccessRequirements = (
  pathname: string
): { any?: Permission[]; all?: Permission[] } => {
  const override = ROUTE_ACCESS_OVERRIDES.find((rule) => matchesPath(pathname, rule.pathPrefix));
  if (override) {
    return { any: override.requiredAny, all: override.requiredAll };
  }

  const route = appRoutes.find((item) => matchesPath(pathname, item.href));
  return { any: route?.requiredAnyPermissions };
};

/**
 * Whether a route declares any permission requirement at all.
 *
 * Callers that hold a cached "this user already passed the guard" flag use this
 * to decide whether the cache is safe to act on: a permission-free route can be
 * rendered from the cache, a permission-gated one cannot, because the cache is
 * keyed by organisation and says nothing about the current path.
 */
export const pathRequiresPermissions = (pathname: string): boolean => {
  const { any, all } = resolveRouteAccessRequirements(normalizePath(pathname));
  return Boolean(any?.length) || Boolean(all?.length);
};

export const canAccessPathByPermissions = (
  pathname: string,
  effectivePermissions: string[] | undefined
): boolean => {
  const normalizedPath = normalizePath(pathname);
  const { any, all } = resolveRouteAccessRequirements(normalizedPath);
  return (
    hasAnyRequiredPermission(effectivePermissions, any) &&
    hasAllRequiredPermissions(effectivePermissions, all)
  );
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
