import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CompanionHistoryController } from "src/controllers/web/companion-history.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionHistoryController.listForCompanion,
);

export default router;
