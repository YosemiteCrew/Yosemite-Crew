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
  withTaskTemplateOrgPermissions,
} from "src/middlewares/rbac";
import {
  requireCompanionPermission,
  requireCompanionPermissionForResource,
  resolveBodyPatientCompanion,
  resolveParentTaskCompanion,
} from "src/middlewares/companion-access";
import { requireSuperAdmin } from "src/middlewares/super-admin";
import { TaskRecommendationController } from "src/controllers/app/task-recommendation.controller";

const router = Router();

/* ─────────────────────────────────────────────────
   MOBILE ROUTES  (NO PREFIX)
   ───────────────────────────────────────────────── */

// A parent adds a task for a companion whose tasks they may work on.
router.post(
  "/mobile/",
  requireMobileAuth,
  requireCompanionPermissionForResource("tasks", resolveBodyPatientCompanion),
  TaskController.createCustomTask,
);

router.post("/mobile/task", requireMobileAuth, TaskController.listParentTasks);

// A parent reaches a task only while they may work on its companion's tasks.
const requireParentTaskAccess = requireCompanionPermissionForResource(
  "tasks",
  resolveParentTaskCompanion,
);

router.get(
  "/mobile/:taskId",
  requireMobileAuth,
  requireParentTaskAccess,
  TaskController.getById,
);

router.patch(
  "/mobile/:taskId",
  requireMobileAuth,
  requireParentTaskAccess,
  TaskController.updateTask,
);

router.delete(
  "/mobile/:taskId",
  requireMobileAuth,
  requireParentTaskAccess,
  TaskController.deleteTask,
);

router.post(
  "/mobile/:taskId/status",
  requireMobileAuth,
  requireParentTaskAccess,
  TaskController.changeStatus,
);

router.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  requireCompanionPermission("tasks", "patientId"),
  TaskController.listForCompanionMobile,
);

// Behind the same co-parent gate as the companion's task list. The rules are
// health-adjacent, and a co-parent whose tasks switch is off should not be able
// to read what has been recommended for the companion either.
router.get(
  "/mobile/companion/:patientId/recommendations",
  requireMobileAuth,
  requireCompanionPermission("tasks", "patientId"),
  TaskRecommendationController.listForCompanion,
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

// Task library routes. The library is shared by every organisation, so
// changing it is limited to platform administrators.

router.get("/pms/library", requireWebAuth, TaskLibraryController.list);

router.post(
  "/pms/library",
  requireWebAuth,
  requireSuperAdmin,
  TaskLibraryController.create,
);

router.put(
  "/pms/library/:libraryId",
  requireWebAuth,
  requireSuperAdmin,
  TaskLibraryController.update,
);

router.get(
  "/pms/library/:libraryId",
  requireWebAuth,
  TaskLibraryController.getById,
);

// Task template routes

// Task template routes belong to one organisation. Routes keyed by a
// template id resolve the organisation from the template itself.

// List templates
router.get(
  "/pms/templates/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskTemplateController.list,
);

// Get single template
router.get(
  "/pms/templates/:templateId",
  requireWebAuth,
  withTaskTemplateOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  TaskTemplateController.getById,
);

// Create template
router.post(
  "/pms/templates",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("tasks:edit:any"),
  TaskTemplateController.create,
);

// Update template
router.patch(
  "/pms/templates/:templateId",
  requireWebAuth,
  withTaskTemplateOrgPermissions(),
  requirePermission("tasks:edit:any"),
  TaskTemplateController.update,
);

// Archive template
router.delete(
  "/pms/templates/:templateId",
  requireWebAuth,
  withTaskTemplateOrgPermissions(),
  requirePermission("tasks:edit:any"),
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
