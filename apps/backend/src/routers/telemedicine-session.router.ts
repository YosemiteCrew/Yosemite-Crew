import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { TelemedicineSessionController } from "src/controllers/web/telemedicine-session.controller";

export const telemedicineSessionRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/telemedicine";

telemedicineSessionRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    TelemedicineSessionController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.schedule,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    TelemedicineSessionController.get,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/start`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.start,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/complete`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.complete,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/cancel`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.cancel,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/no-show`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.markNoShow,
  );
