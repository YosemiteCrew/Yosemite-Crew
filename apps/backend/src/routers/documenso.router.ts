import { Router } from "express";
import { DocumensoAuthController } from "src/controllers/web/documenso.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/pms/redirect/:orgId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumensoAuthController.createRedirectUrl,
);

export default router;
