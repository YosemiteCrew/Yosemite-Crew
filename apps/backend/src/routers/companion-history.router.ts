import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import {
  withOrgPermissions,
  requirePermission,
  requireAllPermissions,
} from "src/middlewares/rbac";
import { CompanionHistoryController } from "src/controllers/web/companion-history.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  CompanionHistoryController.listForCompanion,
);

// Vital records are clinical forms, so reading them needs forms access as
// well as access to the companion.
router.get(
  "/pms/organisation/:organisationId/companion/:patientId/vitals",
  requireWebAuth,
  withOrgPermissions(),
  requireAllPermissions(["companions:view:any", "forms:view:any"]),
  CompanionHistoryController.listVitalsForCompanion,
);

export default router;
