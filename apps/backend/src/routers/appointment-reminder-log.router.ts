import { Router } from "express";
import { AppointmentReminderLogController } from "src/controllers/web/appointment-reminder-log.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

export const appointmentReminderLogRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/reminder-logs";

appointmentReminderLogRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentReminderLogController.record,
);

appointmentReminderLogRouter.patch(
  `${BASE}/:logId/outcome`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  AppointmentReminderLogController.updateOutcome,
);

appointmentReminderLogRouter.get(
  `${BASE}/stats`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.stats,
);

appointmentReminderLogRouter.get(
  `${BASE}/by-appointment/:appointmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.listForAppointment,
);

appointmentReminderLogRouter.get(
  `${BASE}/by-client/:clientId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.listForClient,
);
