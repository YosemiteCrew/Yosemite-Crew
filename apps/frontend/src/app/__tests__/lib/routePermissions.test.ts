import {
  canAccessPathByPermissions,
  hasAnyRequiredPermission,
  resolveFirstAccessibleAppRoute,
  resolveMembershipPermissions,
} from '@/app/lib/routePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';

describe('routePermissions', () => {
  it('allows routes with no required permissions', () => {
    expect(canAccessPathByPermissions('/organization', [])).toBe(true);
  });

  it('requires integrations:view:any for integrations routes', () => {
    expect(canAccessPathByPermissions('/integrations', [])).toBe(false);
    expect(canAccessPathByPermissions('/integrations/merck-manuals', [])).toBe(false);
    expect(
      canAccessPathByPermissions('/integrations/merck-manuals', [PERMISSIONS.INTEGRATIONS_VIEW_ANY])
    ).toBe(true);
  });

  it('requires integrations:view:any for IDEXX workspace route override', () => {
    expect(canAccessPathByPermissions('/appointments/idexx-workspace', [])).toBe(false);
    expect(
      canAccessPathByPermissions('/appointments/idexx-workspace', [
        PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      ])
    ).toBe(false);
    expect(
      canAccessPathByPermissions('/appointments/idexx-workspace', [
        PERMISSIONS.INTEGRATIONS_VIEW_ANY,
      ])
    ).toBe(true);
  });

  it('hasAnyRequiredPermission returns false when required permissions are missing', () => {
    expect(
      hasAnyRequiredPermission([PERMISSIONS.TASKS_VIEW_OWN], [PERMISSIONS.TASKS_VIEW_ANY])
    ).toBe(false);
  });

  it('returns the first accessible app route based on permissions', () => {
    expect(resolveFirstAccessibleAppRoute([])).toBe('/organization');
    expect(resolveFirstAccessibleAppRoute([PERMISSIONS.APPOINTMENTS_VIEW_OWN])).toBe(
      '/organization'
    );
    expect(resolveFirstAccessibleAppRoute([PERMISSIONS.ANALYTICS_VIEW_ANY])).toBe('/dashboard');
  });

  it('normalizes path without leading slash by prepending /', () => {
    // canAccessPathByPermissions internally normalizes the path
    // A path like 'organization' should behave like '/organization'
    expect(canAccessPathByPermissions('organization', [])).toBe(true);
  });

  it('normalizes empty/null path to /', () => {
    // empty string resolves to '/' which has no required permissions
    expect(canAccessPathByPermissions('', [])).toBe(true);
  });

  it('hasAnyRequiredPermission returns true when no required permissions', () => {
    expect(hasAnyRequiredPermission([], undefined)).toBe(true);
    expect(hasAnyRequiredPermission([], [])).toBe(true);
  });

  it('hasAnyRequiredPermission returns false when effectivePermissions is empty', () => {
    expect(hasAnyRequiredPermission([], [PERMISSIONS.INTEGRATIONS_VIEW_ANY])).toBe(false);
  });

  it('hasAnyRequiredPermission returns true when matching permission found', () => {
    expect(
      hasAnyRequiredPermission(
        [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
        [PERMISSIONS.INTEGRATIONS_VIEW_ANY]
      )
    ).toBe(true);
  });

  it('prefers first accessible route over custom fallback route', () => {
    expect(resolveFirstAccessibleAppRoute([], '/home')).toBe('/organization');
  });

  describe('resolveMembershipPermissions', () => {
    it('returns an empty list when there is no membership', () => {
      expect(resolveMembershipPermissions(null)).toEqual([]);
      expect(resolveMembershipPermissions()).toEqual([]);
    });

    it('falls back to the stored set when the role is unrecognised', () => {
      expect(
        resolveMembershipPermissions({
          roleCode: 'NOT_A_ROLE',
          effectivePermissions: [PERMISSIONS.TASKS_VIEW_ANY],
        })
      ).toEqual([PERMISSIONS.TASKS_VIEW_ANY]);
    });

    it('repairs a drifted stored set from the role baseline', () => {
      // An owner row written before analytics joined the role table keeps that
      // stale set forever, which greyed the Dashboard nav entry for the owner.
      const resolved = resolveMembershipPermissions({
        roleCode: 'OWNER',
        effectivePermissions: [PERMISSIONS.TASKS_VIEW_ANY],
      });

      expect(resolved).toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
      expect(resolved).toContain(PERMISSIONS.TASKS_VIEW_ANY);
    });

    it('keeps extra grants and honours explicit revocations', () => {
      const resolved = resolveMembershipPermissions({
        roleCode: 'OWNER',
        effectivePermissions: [],
        extraPermissions: ['custom:extra'],
        revokedPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
      });

      expect(resolved).toContain('custom:extra');
      expect(resolved).toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
      expect(resolved).not.toContain(PERMISSIONS.TASKS_VIEW_ANY);
    });
  });
});
