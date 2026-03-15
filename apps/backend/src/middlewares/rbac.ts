// src/middlewares/rbac.ts
import { NextFunction, Response, Request } from "express";
import {
  Permission,
  ROLE_PERMISSIONS,
  RoleCode,
} from "../models/role-permission";
import { AuthenticatedRequest } from "./auth";
import UserOrganizationModel from "src/models/user-organization";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

export interface OrgRequest extends AuthenticatedRequest {
  userPermissions?: Permission[];
  organisationId?: string;
}

/**
 * Extract orgId from params, headers, or body.
 */
function extractOrgId(req: Request): string | null {
  return (
    req.params.orgId ||
    req.params.organisationId ||
    req.params.organizationId ||
    (req.headers["x-org-id"] as string) ||
    req.body?.organisationId ||
    null
  );
}

export function withOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;

    const userId = typedReq.userId;
    const orgId = extractOrgId(req);

    if (!userId || !orgId) {
      return res
        .status(400)
        .json({ message: "Missing userId or organisationId" });
    }

    try {
      // Matching both raw ID and FHIR-style reference
      const mapping = isReadFromPostgres()
        ? await prisma.userOrganization.findFirst({
            where: {
              practitionerReference: userId,
              OR: [
                { organizationReference: orgId },
                { organizationReference: `Organization/${orgId}` },
              ],
            },
          })
        : await UserOrganizationModel.findOne({
            practitionerReference: userId,
            $or: [
              { organizationReference: orgId },
              { organizationReference: `Organization/${orgId}` },
            ],
          });

      if (!mapping) {
        return res.status(403).json({
          message: "You are not associated with this organisation",
        });
      }

      const effectivePermissions = normalizePermissions(
        (mapping as any).effectivePermissions,
      );

      const computed = computeEffectivePermissions(
        (mapping as any).roleCode as RoleCode,
        (mapping as any).extraPermissions,
        (mapping as any).revokedPermissions,
      );

      if (samePermissions(effectivePermissions, computed)) {
        typedReq.userPermissions = effectivePermissions;
      } else if (isReadFromPostgres()) {
        await prisma.userOrganization.updateMany({
          where: { id: (mapping as any).id },
          data: { effectivePermissions: computed },
        });
        typedReq.userPermissions = computed;
      } else {
        const updated = await UserOrganizationModel.findByIdAndUpdate(
          (mapping as any)._id,
          { $set: { effectivePermissions: computed } },
          { new: true },
        );
        typedReq.userPermissions = normalizePermissions(
          (updated as any)?.effectivePermissions ?? computed,
        );
      }

      typedReq.organisationId = orgId;

      return next();
    } catch (err) {
      console.error("Error resolving permissions:", err);
      return res.status(500).json({
        message: "Failed to resolve permissions",
      });
    }
  };
}

export function requirePermission(required: Permission | Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;
    const perms = typedReq.userPermissions;

    if (!perms) {
      return res.status(500).json({
        message:
          "Permissions not loaded. Include withOrgPermissions before requirePermission.",
      });
    }

    const ok = Array.isArray(required)
      ? required.every((r) => perms.includes(r))
      : perms.includes(required);

    if (!ok) {
      return res
        .status(403)
        .json({ message: "Forbidden – insufficient permissions" });
    }

    return next();
  };
}

function normalizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];

  const set = new Set<Permission>();

  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      set.add(entry.trim() as Permission);
    }
  }
  return [...set];
}

function computeEffectivePermissions(
  role: RoleCode | undefined,
  extra?: string[],
  revoked?: string[],
): Permission[] {
  if (!role) return normalizePermissions(extra);
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = normalizePermissions(extra);
  const removed = new Set(normalizePermissions(revoked));
  const combined = new Set<Permission>([...base, ...extras]);
  for (const permission of removed) {
    combined.delete(permission);
  }
  return [...combined];
}

function samePermissions(a: Permission[], b: Permission[]) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const permission of b) {
    if (!setA.has(permission)) return false;
  }
  return true;
}
