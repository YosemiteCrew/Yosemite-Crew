import { Router } from "express";
import { AuditTrailController } from "src/controllers/web/audit-trail.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/companion/:companionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForCompanion,
);

router.get(
  "/appointment/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForAppointment,
);

export default router;
