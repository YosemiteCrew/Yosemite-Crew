import { Router } from "express";
import { AppointmentReminderLogController } from "src/controllers/web/appointment-reminder-log.controller";
import { requirePermission } from "src/middlewares/rbac";

export const appointmentReminderLogRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/reminder-logs";

appointmentReminderLogRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  AppointmentReminderLogController.record,
);

appointmentReminderLogRouter.patch(
  `${BASE}/:logId/outcome`,
  requirePermission("appointments:edit:any"),
  AppointmentReminderLogController.updateOutcome,
);

appointmentReminderLogRouter.get(
  `${BASE}/stats`,
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.stats,
);

appointmentReminderLogRouter.get(
  `${BASE}/by-appointment/:appointmentId`,
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.listForAppointment,
);

appointmentReminderLogRouter.get(
  `${BASE}/by-client/:clientId`,
  requirePermission("appointments:view:any"),
  AppointmentReminderLogController.listForClient,
);
