import { Router } from "express";
import {
  TaskController,
  TaskLibraryController,
  TaskTemplateController,
} from "src/controllers/web/task.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

/* ─────────────────────────────────────────────────
   MOBILE ROUTES  (NO PREFIX)
   ───────────────────────────────────────────────── */

router.post(
  "/mobile/",
  //authorizeCognitoMobile,
  TaskController.createCustomTask,
);

router.get(
  "/mobile/task",
  authorizeCognitoMobile,
  TaskController.listParentTasks,
);

router.get("/mobile/:taskId", authorizeCognitoMobile, TaskController.getById);

router.patch(
  "/mobile/:taskId",
  authorizeCognitoMobile,
  TaskController.updateTask,
);

router.post(
  "/mobile/:taskId/status",
  authorizeCognitoMobile,
  TaskController.changeStatus,
);

router.get(
  "/mobile/companion/:companionId",
  authorizeCognitoMobile,
  TaskController.listForCompanion,
);

/* ─────────────────────────────────────────────────
   PMS ROUTES — ALL PREFIXED WITH /pms
   ───────────────────────────────────────────────── */

router.post(
  "/pms/from-library",
  authorizeCognito,
  TaskController.createFromLibrary,
);

router.post(
  "/pms/from-template",
  authorizeCognito,
  TaskController.createFromTemplate,
);

// Employee task list
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  TaskController.listEmployeeTasks,
);

// Companion tasks (PMS perspective)
router.get(
  "/pms/companion/:companionId",
  authorizeCognito,
  TaskController.listForCompanion,
);

// Single task detail
router.get("/pms/:taskId", authorizeCognito, TaskController.getById);

router.patch("/pms/:taskId", authorizeCognito, TaskController.updateTask);

router.post(
  "/pms/:taskId/status",
  authorizeCognito,
  TaskController.changeStatus,
);

// Task library routes

router.get("/pms/library", authorizeCognito, TaskLibraryController.list);

router.get(
  "/pms/library/:libraryId",
  authorizeCognito,
  TaskLibraryController.getById,
);

// Task template routes

// List templates
router.get(
  "/pms/templates/organisation/:organisationId",
  authorizeCognito,
  TaskTemplateController.list,
);

// Get single template
router.get(
  "/pms/templates/:templateId",
  authorizeCognito,
  TaskTemplateController.getById,
);

// Create template
router.post("/pms/templates", authorizeCognito, TaskTemplateController.create);

// Update template
router.patch(
  "/pms/templates/:templateId",
  authorizeCognito,
  TaskTemplateController.update,
);

// Archive template
router.delete(
  "/pms/templates/:templateId",
  authorizeCognito,
  TaskTemplateController.archive,
);

export default router;
