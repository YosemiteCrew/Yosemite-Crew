// src/middlewares/rbac.ts
import { NextFunction, Response, Request } from "express";
import { RbacService } from "../services/rbac.service";
import { Permission } from "../models/role-permission";
import { AuthenticatedRequest } from "./auth";

export interface OrgRequest extends AuthenticatedRequest {
  params: {
    orgId: string;
    [key: string]: string;
  };
  userPermissions?: Permission[];
}

export function withOrgPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;
    const userId = typedReq.userId;
    const orgId = typedReq.params.orgId || (req.headers["x-org-id"] as string);

    if (!userId || !orgId) {
      return res.status(400).json({ message: "Missing userId or orgId" });
    }

    try {
      const permissions = await RbacService.getUserPermissionsForOrg(
        userId,
        orgId,
      );
      typedReq.userPermissions = permissions;
      return next();
    } catch (err) {
      console.error("Error resolving permissions", err);
      return res
        .status(500)
        .json({ message: "Failed to resolve permissions" });
    }
  };
}

export function requirePermission(required: Permission | Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const typedReq = req as OrgRequest;
    const perms = typedReq.userPermissions;

    if (!perms) {
      return res
        .status(500)
        .json({ message: "Permissions not loaded. Use withOrgPermissions first." });
    }

    const ok = Array.isArray(required)
      ? required.every((p) => perms.includes(p))
      : perms.includes(required);

    if (!ok) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}