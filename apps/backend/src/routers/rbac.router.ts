// src/routes/pms/rbac.routes.ts
import { Router } from "express";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { RbacController } from "src/controllers/web/rbac.controller"
import { authorizeCognito } from "src/middlewares/auth";

const router = Router({ mergeParams: true });

// Only Owner or Admin with special rights can modify RBAC
router.post(
  "/:userId/permissions",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  RbacController.addPermission
);

router.delete(
  "/:userId/permissions",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  RbacController.removePermission
);

export default router;