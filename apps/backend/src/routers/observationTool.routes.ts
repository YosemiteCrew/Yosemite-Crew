import { Router } from "express";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requireCompanionPermissionForResource,
  resolveBodyPatientCompanion,
  resolveObservationSubmissionCompanion,
  resolveObservationTaskCompanion,
} from "src/middlewares/companion-access";
import { requireSuperAdmin } from "src/middlewares/super-admin";
import {
  requirePermission,
  withAppointmentOrgPermissions,
  withOrgPermissions,
  withTaskOrgPermissions,
} from "src/middlewares/rbac";
import {
  ObservationToolDefinitionController,
  ObservationToolSubmissionController,
} from "src/controllers/web/observationTool.controller";

const router = Router();

/**
 * MOBILE APP ROUTES
 * prefix: /app/observation-tools/...
 */

// Parent lists available OT definitions (for UI)
router.get(
  "/mobile/tools",
  requireMobileAuth,
  ObservationToolDefinitionController.list,
);

// Parent loads one OT definition
router.get(
  "/mobile/tools/:toolId",
  requireMobileAuth,
  ObservationToolDefinitionController.getById,
);

// Parent submits OT for a companion they may record results for
router.post(
  "/mobile/tools/:toolId/submissions",
  requireMobileAuth,
  requireCompanionPermissionForResource(
    "medicalRecords",
    resolveBodyPatientCompanion,
  ),
  ObservationToolSubmissionController.createFromMobile,
);

router.post(
  "/mobile/submissions/:submissionId/link-appointment",
  requireMobileAuth,
  requireCompanionPermissionForResource(
    "appointments",
    resolveObservationSubmissionCompanion,
  ),
  ObservationToolSubmissionController.linkAppointmentFromMobile,
);

router.get(
  "/mobile/tasks/:taskId/preview",
  requireMobileAuth,
  requireCompanionPermissionForResource(
    "medicalRecords",
    resolveObservationTaskCompanion,
  ),
  ObservationToolSubmissionController.getPreviewByTaskId,
);

/**
 * PMS ROUTES
 * prefix: /pms/observation-tools + /pms/observation-submissions
 */

// Definitions. The library is shared by every organisation, so changing it
// is limited to platform administrators.
router.get(
  "/pms/tools",
  requireWebAuth,
  ObservationToolDefinitionController.list,
);

router.get(
  "/pms/tools/:toolId",
  requireWebAuth,
  ObservationToolDefinitionController.getById,
);

router.post(
  "/pms/tools",
  requireWebAuth,
  requireSuperAdmin,
  ObservationToolDefinitionController.create,
);

router.patch(
  "/pms/tools/:toolId",
  requireWebAuth,
  requireSuperAdmin,
  ObservationToolDefinitionController.update,
);

router.post(
  "/pms/tools/:toolId/archive",
  requireWebAuth,
  requireSuperAdmin,
  ObservationToolDefinitionController.archive,
);

// Submissions
router.get(
  "/pms/submissions",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ObservationToolSubmissionController.listForPms,
);

router.get(
  "/pms/submissions/:submissionId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ObservationToolSubmissionController.getById,
);

router.post(
  "/pms/submissions/:submissionId/link-appointment",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ObservationToolSubmissionController.linkAppointment,
);

router.post(
  "/pms/appointments/:appointmentId/submissions",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission("appointments:view:any"),
  ObservationToolSubmissionController.listForAppointment,
);

router.post(
  "/pms/appointments/:appointmentId/submissions/create",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ObservationToolSubmissionController.createForAppointment,
);

router.get(
  "/pms/tasks/:taskId/submission",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission("tasks:view:any"),
  ObservationToolSubmissionController.getByTaskId,
);

router.get(
  "/pms/tasks/:taskId/preview",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission("tasks:view:any"),
  ObservationToolSubmissionController.getPreviewByTaskId,
);

router.get(
  "/pms/appointments/:appointmentId/task-previews",
  requireWebAuth,
  withAppointmentOrgPermissions(),
  requirePermission("appointments:view:any"),
  ObservationToolSubmissionController.listTaskPreviewsForAppointment,
);

export default router;
