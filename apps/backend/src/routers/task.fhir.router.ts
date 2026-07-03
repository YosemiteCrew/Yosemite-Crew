import { Router } from "express";
import { TaskFhirController } from "src/controllers/web/task.fhir.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  (req, res) => TaskFhirController.listEmployeeTasks(req, res),
);

router.get(
  "/companion/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  (req, res) => TaskFhirController.listCompanionTasks(req, res),
);

router.post(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskFhirController.create(req, res),
);

router.get(
  "/organisation/:organisationId/:taskId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:view:any", "tasks:view:own"]),
  (req, res) => TaskFhirController.getById(req, res),
);

router.patch(
  "/organisation/:organisationId/:taskId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskFhirController.update(req, res),
);

router.post(
  String.raw`/organisation/:organisationId/:taskId/\$status`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskFhirController.changeStatus(req, res),
);

export default router;
