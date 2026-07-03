import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CaseController } from "src/controllers/web/case-encounter.controller";

const router = Router();

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CaseController.create,
);

router.patch(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CaseController.update,
);

router.get(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CaseController.getById,
);

router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CaseController.list,
);

export default router;
