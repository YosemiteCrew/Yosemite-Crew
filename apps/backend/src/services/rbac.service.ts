// src/services/rbac.service.ts
import UserOrganizationModel from "../models/user-organization";
import {
  ROLE_PERMISSIONS,
  Permission,
  RoleCode,
} from "../models/role-permission";

export class RbacServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
  ) {
    super(message);
    this.name = "RbacServiceError";
  }
}

export const RbacService = {
  async getUserPermissionsForOrg(
    userId: string,
    organisationId: string,
  ): Promise<Permission[]> {
    if (!userId || !organisationId) {
      throw new RbacServiceError("userId and organisationId are required", 400);
    }

    const practitionerReference = userId;
    const organizationReference = organisationId;

    const rows = await UserOrganizationModel.find({
      practitionerReference,
      organizationReference,
      active: true,
    }).lean();

    const perms = new Set<Permission>();

    for (const row of rows) {
      const roleCode = row.roleCode as RoleCode;
      const base = ROLE_PERMISSIONS[roleCode] ?? [];
      base.forEach((p) => perms.add(p));

      (row.extraPermissions ?? []).forEach((p) => perms.add(p as Permission));
    }

    return [...perms];
  },

  hasPermission(
    permissions: Permission[],
    required: Permission | Permission[],
  ): boolean {
    const set = new Set(permissions);
    if (Array.isArray(required)) {
      return required.every((r) => set.has(r));
    }
    return set.has(required);
  },

  async addExtraPermission(
    userId: string,
    orgId: string,
    permission: Permission
  ) {
    const practitionerReference = `Practitioner/${userId}`;
    const organizationReference = `Organization/${orgId}`;

    const row = await UserOrganizationModel.findOne({
      practitionerReference,
      organizationReference,
      active: true,
    });

    if (!row) {
      throw new RbacServiceError("User is not assigned to this organisation", 404);
    }

    if (!row.extraPermissions?.includes(permission)) {
      row.extraPermissions?.push(permission);
      await row.save();
    }

    return row;
  },

  async removeExtraPermission(
    userId: string,
    orgId: string,
    permission: Permission
  ) {
    const practitionerReference = `Practitioner/${userId}`;
    const organizationReference = `Organization/${orgId}`;

    const row = await UserOrganizationModel.findOne({
      practitionerReference,
      organizationReference,
      active: true,
    });

    if (!row) {
      throw new RbacServiceError("User is not assigned to this organisation", 404);
    }

    row.extraPermissions = row.extraPermissions?.filter((p) => p !== permission);
    await row.save();

    return row;
  },
};
