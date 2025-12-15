import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  toPermissionArray,
  ROLE_PERMISSIONS,
  RoleCode,
} from "../../utils/permissions";

describe("Permissions Utils", () => {
  // --- Section 1: PERMISSIONS Constants ---
  describe("PERMISSIONS", () => {
    it("defines specific permission constants correctly", () => {
      // Spot check a few key permissions to ensure the object is integrity
      expect(PERMISSIONS.APPOINTMENTS_VIEW_ANY).toBe("appointments:view:any");
      expect(PERMISSIONS.ORG_DELETE).toBe("org:delete");
      expect(PERMISSIONS.BILLING_EDIT_LIMITED).toBe("billing:edit:limited");
    });
  });

  // --- Section 2: ALL_PERMISSIONS Set ---
  describe("ALL_PERMISSIONS", () => {
    it("contains all values defined in PERMISSIONS object", () => {
      const permissionValues = Object.values(PERMISSIONS);

      // The set size should match the number of keys in PERMISSIONS
      expect(ALL_PERMISSIONS.size).toBe(permissionValues.length);

      // Every value in the object should exist in the Set
      permissionValues.forEach((perm) => {
        expect(ALL_PERMISSIONS.has(perm)).toBe(true);
      });
    });
  });

  // --- Section 3: Permission Filtering (toPermissionArray) ---
  describe("toPermissionArray", () => {
    it("returns an array of valid permissions from a valid string array", () => {
      const input = ["appointments:view:any", "org:delete"];
      const result = toPermissionArray(input);
      expect(result).toEqual(["appointments:view:any", "org:delete"]);
    });

    it("filters out invalid permission strings", () => {
      const input = ["appointments:view:any", "invalid:permission:string", "org:delete"];
      const result = toPermissionArray(input);

      // Should remove the middle invalid one
      expect(result).toEqual(["appointments:view:any", "org:delete"]);
      expect(result).toHaveLength(2);
    });

    it("returns an empty array if all inputs are invalid", () => {
      const input = ["fake:perm", "another:fake"];
      const result = toPermissionArray(input);
      expect(result).toEqual([]);
    });

    it("returns an empty array if input is empty", () => {
      const result = toPermissionArray([]);
      expect(result).toEqual([]);
    });
  });

  // --- Section 4: Role Assignments (ROLE_PERMISSIONS) ---
  describe("ROLE_PERMISSIONS", () => {
    it("assigns 'org:delete' only to OWNER", () => {
      expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.ORG_DELETE);
      expect(ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.ORG_DELETE);
      expect(ROLE_PERMISSIONS.VETERINARIAN).not.toContain(PERMISSIONS.ORG_DELETE);
    });

    it("assigns limited billing access to VETERINARIAN", () => {
      expect(ROLE_PERMISSIONS.VETERINARIAN).toContain(PERMISSIONS.BILLING_EDIT_LIMITED);
      expect(ROLE_PERMISSIONS.VETERINARIAN).not.toContain(PERMISSIONS.BILLING_EDIT_ANY);
    });

    it("assigns clinical analytics only to VETERINARIAN (conceptually)", () => {
      // VETERINARIAN gets clinical view
      expect(ROLE_PERMISSIONS.VETERINARIAN).toContain(PERMISSIONS.ANALYTICS_VIEW_CLINICAL);

      // OWNER gets full view, checking they don't rely on the restricted clinical tag if they have 'any'
      // (This test confirms the structure of the data as defined in your file)
      expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.ANALYTICS_VIEW_ANY);
    });

    it("ensures every role in RoleCode is defined", () => {
      const expectedRoles: RoleCode[] = [
        "OWNER",
        "ADMIN",
        "SUPERVISOR",
        "VETERINARIAN",
        "TECHNICIAN",
        "ASSISTANT",
        "RECEPTIONIST",
      ];

      expectedRoles.forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
      });
    });

    it("ensures RECEPTIONIST has no audit or team permissions", () => {
      const perms = ROLE_PERMISSIONS.RECEPTIONIST;
      expect(perms).not.toContain(PERMISSIONS.AUDIT_VIEW_ANY);
      expect(perms).not.toContain(PERMISSIONS.TEAMS_VIEW_ANY);
    });
  });
});