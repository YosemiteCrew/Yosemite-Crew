import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PatientCheckInController } from "src/controllers/web/patient-check-in.controller";

export const patientCheckInRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/check-in";

patientCheckInRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    PatientCheckInController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.create,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    PatientCheckInController.get,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId/seen`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.markSeen,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId/complete`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.complete,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId/cancel`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.cancel,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId/no-show`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.markNoShow,
  );

patientCheckInRouter
  .route(`${BASE}/:checkInId/room`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    PatientCheckInController.assignRoom,
  );
