import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CareReminderController } from "src/controllers/web/care-reminder.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/care-reminders",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CareReminderController.list,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.create,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/bulk",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.bulkCreate,
);

router.get(
  "/pms/organisation/:organisationId/care-reminders/:reminderId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CareReminderController.get,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/send",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.send,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/respond",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.markResponded,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.cancel,
);

export default router;
