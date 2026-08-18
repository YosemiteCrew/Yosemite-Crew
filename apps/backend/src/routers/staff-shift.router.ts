import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { StaffShiftController } from "src/controllers/web/staff-shift.controller";

export const staffShiftRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/staff-shifts";

staffShiftRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    StaffShiftController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.create,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    StaffShiftController.get,
  )
  .patch(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.update,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/start`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.start,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/complete`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.complete,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/cancel`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.cancel,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/no-show`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    StaffShiftController.markNoShow,
  );
