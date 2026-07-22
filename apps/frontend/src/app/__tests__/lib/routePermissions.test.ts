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

  it('requires labs:view:any for the IDEXX workspace route override', () => {
    expect(canAccessPathByPermissions('/appointments/idexx-workspace', [])).toBe(false);
    expect(
      canAccessPathByPermissions('/appointments/idexx-workspace', [
        PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      ])
    ).toBe(false);
    // Seeing the integration is not enough: the workspace loads lab results and
    // orders on open, and those routes require labs:view:any.
    expect(
      canAccessPathByPermissions('/appointments/idexx-workspace', [
        PERMISSIONS.INTEGRATIONS_VIEW_ANY,
      ])
    ).toBe(false);
    expect(
      canAccessPathByPermissions('/appointments/idexx-workspace', [PERMISSIONS.LABS_VIEW_ANY])
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

    it('grants only the extras when the role is unrecognised', () => {
      expect(
        resolveMembershipPermissions({
          roleCode: 'NOT_A_ROLE',
          extraPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
        })
      ).toEqual([PERMISSIONS.TASKS_VIEW_ANY]);
    });

    it('still applies revocations when the role is unrecognised', () => {
      // The backend only skips the revocation step when there is no role at
      // all; a role that is merely unknown resolves against an empty baseline
      // and still has its revocations subtracted.
      expect(
        resolveMembershipPermissions({
          roleCode: 'NOT_A_ROLE',
          extraPermissions: [PERMISSIONS.TASKS_VIEW_ANY, PERMISSIONS.INTEGRATIONS_VIEW_ANY],
          revokedPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
        })
      ).toEqual([PERMISSIONS.INTEGRATIONS_VIEW_ANY]);
    });

    it('returns the extras verbatim when there is no role at all', () => {
      expect(
        resolveMembershipPermissions({
          extraPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
          revokedPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
        })
      ).toEqual([PERMISSIONS.TASKS_VIEW_ANY]);
    });

    it('derives the full baseline for a recognised role', () => {
      // An owner row written before analytics joined the role table keeps a
      // stale snapshot forever, which greyed the Dashboard nav entry for the
      // owner. Deriving from the role instead repairs it.
      const resolved = resolveMembershipPermissions({ roleCode: 'OWNER' });

      expect(resolved).toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
      expect(resolved).toContain(PERMISSIONS.TASKS_VIEW_ANY);
    });

    it('never grants a permission the role does not carry', () => {
      // Removing a permission from the role table leaves it behind in earlier
      // snapshots without ever reaching revokedPermissions, so the snapshot is
      // not a grant source at all: only role plus extras count.
      const resolved = resolveMembershipPermissions({ roleCode: 'TECHNICIAN' });

      expect(resolved).not.toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
      expect(resolved).toContain(PERMISSIONS.INTEGRATIONS_VIEW_ANY);
    });

    it('grants nothing for an explicitly deactivated membership', () => {
      // The backend RBAC lookup requires active: true, so a client that still
      // holds a deactivated mapping must not light up nav for an offboarded user.
      expect(
        resolveMembershipPermissions({
          roleCode: 'OWNER',
          active: false,
          extraPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
        })
      ).toEqual([]);
    });

    it('treats a missing active flag as active, matching the backend default', () => {
      expect(resolveMembershipPermissions({ roleCode: 'OWNER' })).toContain(
        PERMISSIONS.ANALYTICS_VIEW_ANY
      );
    });

    it('grants exactly the extras on a membership with no recognised role', () => {
      // The backend returns the extras verbatim when there is no role, so the
      // extras are the whole grant: nothing is inherited from a snapshot.
      expect(
        resolveMembershipPermissions({
          extraPermissions: [PERMISSIONS.INTEGRATIONS_VIEW_ANY],
        })
      ).toEqual([PERMISSIONS.INTEGRATIONS_VIEW_ANY]);
    });

    it('grants integrations to every role the backend grants it to', () => {
      // The client role table had drifted from the backend for the non-admin
      // roles, which hid /integrations from users the API authorises.
      const roles = [
        'SUPERVISOR',
        'VETERINARIAN',
        'TECHNICIAN',
        'ASSISTANT',
        'RECEPTIONIST',
      ] as const;

      for (const roleCode of roles) {
        expect(resolveMembershipPermissions({ roleCode })).toContain(
          PERMISSIONS.INTEGRATIONS_VIEW_ANY
        );
      }
    });

    it('keeps extra grants and honours explicit revocations', () => {
      const resolved = resolveMembershipPermissions({
        roleCode: 'OWNER',
        extraPermissions: ['custom:extra'],
        revokedPermissions: [PERMISSIONS.TASKS_VIEW_ANY],
      });

      expect(resolved).toContain('custom:extra');
      expect(resolved).toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
      expect(resolved).not.toContain(PERMISSIONS.TASKS_VIEW_ANY);
    });
  });
});
