import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { CareReminderController } from "src/controllers/web/care-reminder.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/care-reminders",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CareReminderController.list,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.create,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/bulk",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.bulkCreate,
);

router.get(
  "/pms/organisation/:organisationId/care-reminders/:reminderId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CareReminderController.get,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/send",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.send,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/respond",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.markResponded,
);

router.post(
  "/pms/organisation/:organisationId/care-reminders/:reminderId/cancel",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CareReminderController.cancel,
);

export default router;
