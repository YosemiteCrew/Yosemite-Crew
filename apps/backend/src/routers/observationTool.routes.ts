import { Router } from "express";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
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
  authorizeCognitoMobile,
  ObservationToolDefinitionController.list,
);

// Parent loads one OT definition
router.get(
  "/mobile/tools/:toolId",
  authorizeCognitoMobile,
  ObservationToolDefinitionController.getById,
);

// Parent submits OT
router.post(
  "/mobile/tools/:toolId/submissions",
  authorizeCognitoMobile,
  ObservationToolSubmissionController.createFromMobile,
);

router.post(
  "/mobile/submissions/:submissionId/link-appointment",
  authorizeCognitoMobile,
  ObservationToolSubmissionController.linkAppointment,
);

router.get(
  "/mobile/tasks/:taskId/preview",
  authorizeCognitoMobile,
  ObservationToolSubmissionController.getPreviewByTaskId,
);

/**
 * PMS ROUTES
 * prefix: /pms/observation-tools + /pms/observation-submissions
 */

// Definitions
router.get(
  "/pms/tools",
  authorizeCognito,
  ObservationToolDefinitionController.list,
);

router.get(
  "/pms/tools/:toolId",
  authorizeCognito,
  ObservationToolDefinitionController.getById,
);

router.post(
  "/pms/tools",
  //authorizeCognito,
  ObservationToolDefinitionController.create,
);

router.patch(
  "/pms/tools/:toolId",
  authorizeCognito,
  ObservationToolDefinitionController.update,
);

router.post(
  "/pms/tools/:toolId/archive",
  authorizeCognito,
  ObservationToolDefinitionController.archive,
);

// Submissions
router.get(
  "/pms/submissions",
  authorizeCognito,
  ObservationToolSubmissionController.listForPms,
);

router.get(
  "/pms/submissions/:submissionId",
  authorizeCognito,
  ObservationToolSubmissionController.getById,
);

router.post(
  "/pms/submissions/:submissionId/link-appointment",
  authorizeCognito,
  ObservationToolSubmissionController.linkAppointment,
);

router.get(
  "/pms/appointments/:appointmentId/submissions",
  authorizeCognito,
  ObservationToolSubmissionController.listForAppointment,
);

router.get(
  "/pms/tasks/:taskId/submission",
  authorizeCognito,
  ObservationToolSubmissionController.getByTaskId,
);

router.get(
  "/pms/tasks/:taskId/preview",
  authorizeCognito,
  ObservationToolSubmissionController.getPreviewByTaskId,
);

router.get(
  "/pms/appointments/:appointmentId/task-previews",
  authorizeCognito,
  ObservationToolSubmissionController.listTaskPreviewsForAppointment,
);

export default router;
