import { Router } from "express";
import { EmergencyTriageController } from "src/controllers/web/emergency-triage.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const emergencyTriageRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/emergency-triage";

emergencyTriageRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EmergencyTriageController.list,
);
emergencyTriageRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EmergencyTriageController.record,
);
emergencyTriageRouter.get(
  `${BASE}/:triageId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EmergencyTriageController.get,
);
emergencyTriageRouter.post(
  `${BASE}/:triageId/escalate`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EmergencyTriageController.escalate,
);

export default emergencyTriageRouter;
