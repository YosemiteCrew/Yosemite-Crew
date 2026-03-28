import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionHistoryController } from "src/controllers/web/companion-history.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/companion/:companionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionHistoryController.listForCompanion,
);

export default router;
