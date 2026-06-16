import { Router } from "express";
import { TaskScheduleFhirController } from "src/controllers/web/task-schedule.fhir.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/organisation/:organisationId/template-instance/:instanceId/$apply",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskScheduleFhirController.apply(req, res),
);

router.post(
  "/organisation/:organisationId/template-instance/:instanceId/$pause",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskScheduleFhirController.pause(req, res),
);

router.post(
  "/organisation/:organisationId/template-instance/:instanceId/$resume",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskScheduleFhirController.resume(req, res),
);

router.post(
  "/organisation/:organisationId/template-instance/:instanceId/$cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskScheduleFhirController.cancel(req, res),
);

router.post(
  "/organisation/:organisationId/template-instance/:instanceId/$regenerate",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["tasks:edit:any", "tasks:edit:own"]),
  (req, res) => TaskScheduleFhirController.regenerate(req, res),
);

export default router;
