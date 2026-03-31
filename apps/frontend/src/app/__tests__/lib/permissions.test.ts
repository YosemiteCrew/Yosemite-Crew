import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  toPermissionArray,
} from '@/app/lib/permissions';

describe('permissions', () => {
  it('exposes all permission constants in ALL_PERMISSIONS', () => {
    expect(ALL_PERMISSIONS.size).toBe(Object.values(PERMISSIONS).length);
  });

  it('filters unknown permission tokens', () => {
    const result = toPermissionArray([
      PERMISSIONS.APPOINTMENTS_VIEW_ANY,
      'not:real:permission',
      PERMISSIONS.TASKS_EDIT_OWN,
    ]);

    expect(result).toEqual([PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.TASKS_EDIT_OWN]);
  });

  it('returns empty array for undefined input', () => {
    expect(toPermissionArray(undefined)).toEqual([]);
  });

  it('keeps role permission sets valid', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) {
      const perms = ROLE_PERMISSIONS[role];
      expect(perms.length).toBeGreaterThan(0);
      expect(perms.every((perm) => ALL_PERMISSIONS.has(perm))).toBe(true);
    }
  });

  it('has expected access boundaries between receptionist and owner', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.ORG_DELETE);
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(PERMISSIONS.ORG_DELETE);
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.INTEGRATIONS_EDIT_ANY);
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(PERMISSIONS.INTEGRATIONS_EDIT_ANY);
  });
});
