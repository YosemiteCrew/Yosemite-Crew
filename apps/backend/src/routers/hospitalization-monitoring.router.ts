import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { HospitalizationMonitoringController } from "src/controllers/web/hospitalization-monitoring.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/hospitalization-monitoring";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  HospitalizationMonitoringController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  HospitalizationMonitoringController.record,
);
router.get(
  `${base}/:obsId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  HospitalizationMonitoringController.get,
);
router.delete(
  `${base}/:obsId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  HospitalizationMonitoringController.delete,
);

export default router;
