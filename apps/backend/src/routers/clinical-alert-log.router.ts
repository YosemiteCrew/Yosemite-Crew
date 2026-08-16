import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { ClinicalAlertLogController } from "src/controllers/web/clinical-alert-log.controller";

export const clinicalAlertLogRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinical-alerts";

clinicalAlertLogRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    ClinicalAlertLogController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.trigger,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    ClinicalAlertLogController.get,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId/acknowledge`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.acknowledge,
  );

clinicalAlertLogRouter
  .route(`${BASE}/:alertId/dismiss`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    ClinicalAlertLogController.dismiss,
  );
