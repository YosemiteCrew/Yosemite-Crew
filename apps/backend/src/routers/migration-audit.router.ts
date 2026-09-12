import { Router } from "express";
import { MigrationAuditController } from "../controllers/app/migration-audit.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   Read-only migration audit (#3056) - staff-only, gated on the same
   `org:onboarding` permission as other practice-onboarding actions.
   ====================================================== */

router.post(
  "/pms/organisations/:organisationId/migration-audit/upload-url",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("org:onboarding"),
  MigrationAuditController.getUploadUrl,
);

router.post(
  "/pms/organisations/:organisationId/migration-audit",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("org:onboarding"),
  MigrationAuditController.createRun,
);

router.get(
  "/pms/organisations/:organisationId/migration-audit/:auditRunId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("org:onboarding"),
  MigrationAuditController.getRun,
);

export default router;
