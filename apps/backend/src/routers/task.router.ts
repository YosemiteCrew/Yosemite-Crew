import { Router } from "express";
import {
  TaskController,
  TaskLibraryController,
  TaskTemplateController,
} from "src/controllers/web/task.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withTaskOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

/* ─────────────────────────────────────────────────
   MOBILE ROUTES  (NO PREFIX)
   ───────────────────────────────────────────────── */

router.post(
  "/mobile/",
  authorizeCognitoMobile,
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
  "/mobile/companion/:patientId",
  authorizeCognitoMobile,
  TaskController.listForCompanion,
);

/* ─────────────────────────────────────────────────
   PMS ROUTES — ALL PREFIXED WITH /pms
   ───────────────────────────────────────────────── */

router.post(
  "/pms/from-library",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createFromLibrary,
);

router.post(
  "/pms/from-template",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createFromTemplate,
);

// PMS — Create Custom Task
router.post(
  "/pms/custom",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createCustomTaskFromPms,
);

// Employee task list
router.get(
  "/pms/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.listEmployeeTasks,
);

// Companion tasks (PMS perspective)
router.get(
  "/pms/companion/:patientId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.listForCompanion,
);

// Task library routes

router.get("/pms/library", authorizeCognito, TaskLibraryController.list);

router.post("/pms/library", authorizeCognito, TaskLibraryController.create);

router.put(
  "/pms/library/:libraryId",
  authorizeCognito,
  TaskLibraryController.update,
);

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

// Single task detail
router.get(
  "/pms/:taskId",
  authorizeCognito,
  withTaskOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.getById,
);

router.patch(
  "/pms/:taskId",
  authorizeCognito,
  withTaskOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.updateTaskPMS,
);

router.post(
  "/pms/:taskId/status",
  authorizeCognito,
  withTaskOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.changeStatusPMS,
);

export default router;
