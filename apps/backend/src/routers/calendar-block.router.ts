import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CalendarBlockController } from "src/controllers/web/calendar-block.controller";

export const calendarBlockRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/calendar-blocks";

calendarBlockRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:view:any"),
    CalendarBlockController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    CalendarBlockController.create,
  );

calendarBlockRouter
  .route(`${BASE}/:blockId`)
  .patch(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    CalendarBlockController.update,
  )
  .delete(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("appointments:edit:any"),
    CalendarBlockController.delete,
  );
