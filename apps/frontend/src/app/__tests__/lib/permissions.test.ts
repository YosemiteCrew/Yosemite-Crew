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

  it('keeps passport capture open to staff and attestation to veterinarians', () => {
    // Mirrors apps/backend/src/models/role-permission.ts: every staff role may
    // capture a passport record, only a veterinarian may sign one.
    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) {
      expect(ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.VACCINATIONS_EDIT_ANY);
      expect(ROLE_PERMISSIONS[role]).toContain(PERMISSIONS.PASSPORT_EDIT_ANY);
    }

    const attesters = (
      Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>
    ).filter((role) => ROLE_PERMISSIONS[role].includes(PERMISSIONS.PASSPORT_ATTEST_ANY));
    expect(attesters).toEqual(['VETERINARIAN']);
  });

  it('has expected access boundaries between receptionist and owner', () => {
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.ORG_DELETE);
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(PERMISSIONS.ORG_DELETE);
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.INTEGRATIONS_EDIT_ANY);
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(PERMISSIONS.INTEGRATIONS_EDIT_ANY);
  });

  it('keeps controlled-drug register defaults least-privileged', () => {
    for (const role of ['OWNER', 'ADMIN', 'SUPERVISOR'] as const) {
      expect(ROLE_PERMISSIONS[role]).toEqual(
        expect.arrayContaining([
          PERMISSIONS.CONTROLLED_DRUG_REGISTER_READ,
          PERMISSIONS.CONTROLLED_DRUG_REGISTER_RECORD,
          PERMISSIONS.CONTROLLED_DRUG_REGISTER_CORRECT,
        ])
      );
    }
    expect(ROLE_PERMISSIONS.VETERINARIAN).toEqual(
      expect.arrayContaining([
        PERMISSIONS.CONTROLLED_DRUG_REGISTER_READ,
        PERMISSIONS.CONTROLLED_DRUG_REGISTER_RECORD,
      ])
    );
    expect(ROLE_PERMISSIONS.VETERINARIAN).not.toContain(
      PERMISSIONS.CONTROLLED_DRUG_REGISTER_CORRECT
    );
    expect(ROLE_PERMISSIONS.TECHNICIAN).toContain(PERMISSIONS.CONTROLLED_DRUG_REGISTER_READ);
    expect(ROLE_PERMISSIONS.TECHNICIAN).not.toContain(PERMISSIONS.CONTROLLED_DRUG_REGISTER_RECORD);
    for (const role of ['ASSISTANT', 'RECEPTIONIST'] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.CONTROLLED_DRUG_REGISTER_READ);
    }
  });
});
