import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { TelemedicineSessionController } from "src/controllers/web/telemedicine-session.controller";

export const telemedicineSessionRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/telemedicine";

telemedicineSessionRouter
  .route(BASE)
  .get(
    requirePermission("appointments:view:any"),
    TelemedicineSessionController.list,
  )
  .post(
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.schedule,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId`)
  .get(
    requirePermission("appointments:view:any"),
    TelemedicineSessionController.get,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/start`)
  .post(
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.start,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/complete`)
  .post(
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.complete,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/cancel`)
  .post(
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.cancel,
  );

telemedicineSessionRouter
  .route(`${BASE}/:sessionId/no-show`)
  .post(
    requirePermission("appointments:edit:any"),
    TelemedicineSessionController.markNoShow,
  );
