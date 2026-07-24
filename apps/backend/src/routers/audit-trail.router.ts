import { Router } from "express";
import { AuditTrailController } from "src/controllers/web/audit-trail.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForCompanion,
);
router.post(
  "/companion",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForCompanion,
);

router.get(
  "/appointment/:appointmentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForAppointment,
);
router.post(
  "/appointment",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("audit:view:any"),
  AuditTrailController.listForAppointment,
);

export default router;
