// src/middlewares/rbac.ts
import { NextFunction, Response, Request } from "express";
import { Permission } from "../models/role-permission";
import { AuthenticatedRequest } from "./auth";
import UserOrganizationModel from "src/models/user-organization";

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
      const mapping = await UserOrganizationModel.findOne({
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
        // field from your updated UserOrganizationSchema
        (mapping as any).effectivePermissions,
      );

      typedReq.userPermissions = effectivePermissions;
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
