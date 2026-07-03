import { Router } from "express";
import {
  TaskController,
  TaskLibraryController,
  TaskTemplateController,
} from "src/controllers/web/task.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withOrgPermissions,
  withTaskOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

/* ─────────────────────────────────────────────────
   MOBILE ROUTES  (NO PREFIX)
   ───────────────────────────────────────────────── */

router.post("/mobile/", requireMobileAuth, TaskController.createCustomTask);

router.get("/mobile/task", requireMobileAuth, TaskController.listParentTasks);

router.get("/mobile/:taskId", requireMobileAuth, TaskController.getById);

router.patch("/mobile/:taskId", requireMobileAuth, TaskController.updateTask);

router.post(
  "/mobile/:taskId/status",
  requireMobileAuth,
  TaskController.changeStatus,
);

router.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  TaskController.listForCompanion,
);

/* ─────────────────────────────────────────────────
   PMS ROUTES — ALL PREFIXED WITH /pms
   ───────────────────────────────────────────────── */

router.post(
  "/pms/from-library",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createFromLibrary,
);

router.post(
  "/pms/from-template",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createFromTemplate,
);

// PMS — Create Custom Task
router.post(
  "/pms/custom",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.createCustomTaskFromPms,
);

// Employee task list
router.get(
  "/pms/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.listEmployeeTasks,
);

// Companion tasks (PMS perspective)
router.get(
  "/pms/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.listForCompanion,
);

// Task library routes

router.get("/pms/library", requireWebAuth, TaskLibraryController.list);

router.post("/pms/library", requireWebAuth, TaskLibraryController.create);

router.put(
  "/pms/library/:libraryId",
  requireWebAuth,
  TaskLibraryController.update,
);

router.get(
  "/pms/library/:libraryId",
  requireWebAuth,
  TaskLibraryController.getById,
);

// Task template routes

// List templates
router.get(
  "/pms/templates/organisation/:organisationId",
  requireWebAuth,
  TaskTemplateController.list,
);

// Get single template
router.get(
  "/pms/templates/:templateId",
  requireWebAuth,
  TaskTemplateController.getById,
);

// Create template
router.post("/pms/templates", requireWebAuth, TaskTemplateController.create);

// Update template
router.patch(
  "/pms/templates/:templateId",
  requireWebAuth,
  TaskTemplateController.update,
);

// Archive template
router.delete(
  "/pms/templates/:templateId",
  requireWebAuth,
  TaskTemplateController.archive,
);

// Single task detail
router.get(
  "/pms/:taskId",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskController.getById,
);

router.patch(
  "/pms/:taskId",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.updateTaskPMS,
);

router.delete(
  "/pms/:taskId",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.deleteTaskPMS,
);

router.post(
  "/pms/:taskId/status",
  requireWebAuth,
  withTaskOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  TaskController.changeStatusPMS,
);

export default router;
