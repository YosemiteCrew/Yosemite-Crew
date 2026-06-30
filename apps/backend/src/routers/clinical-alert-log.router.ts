import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { ClinicalAlertLogController } from "src/controllers/web/clinical-alert-log.controller";

export const clinicalAlertLogRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinical-alerts";

clinicalAlertLogRouter
  .route(BASE)
  .get(
    requirePermission("companions:view:any"),
    ClinicalAlertLogController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.trigger,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId`)
  .get(
    requirePermission("companions:view:any"),
    ClinicalAlertLogController.get,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId/acknowledge`)
  .post(
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.acknowledge,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId/dismiss`)
  .post(
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.dismiss,
  );
