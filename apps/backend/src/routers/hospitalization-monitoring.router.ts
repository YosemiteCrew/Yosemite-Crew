import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { HospitalizationMonitoringController } from "src/controllers/web/hospitalization-monitoring.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/hospitalization-monitoring";

router.get(
  base,
  requirePermission("appointments:view:any"),
  HospitalizationMonitoringController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  HospitalizationMonitoringController.record,
);
router.get(
  `${base}/:obsId`,
  requirePermission("appointments:view:any"),
  HospitalizationMonitoringController.get,
);
router.delete(
  `${base}/:obsId`,
  requirePermission("appointments:edit:any"),
  HospitalizationMonitoringController.delete,
);

export default router;
