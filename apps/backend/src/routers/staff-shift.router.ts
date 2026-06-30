import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { StaffShiftController } from "src/controllers/web/staff-shift.controller";

export const staffShiftRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/staff-shifts";

staffShiftRouter
  .route(BASE)
  .get(requirePermission("appointments:view:any"), StaffShiftController.list)
  .post(
    requirePermission("appointments:edit:any"),
    StaffShiftController.create,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId`)
  .get(requirePermission("appointments:view:any"), StaffShiftController.get)
  .patch(
    requirePermission("appointments:edit:any"),
    StaffShiftController.update,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/start`)
  .post(requirePermission("appointments:edit:any"), StaffShiftController.start);

staffShiftRouter
  .route(`${BASE}/:shiftId/complete`)
  .post(
    requirePermission("appointments:edit:any"),
    StaffShiftController.complete,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/cancel`)
  .post(
    requirePermission("appointments:edit:any"),
    StaffShiftController.cancel,
  );

staffShiftRouter
  .route(`${BASE}/:shiftId/no-show`)
  .post(
    requirePermission("appointments:edit:any"),
    StaffShiftController.markNoShow,
  );
