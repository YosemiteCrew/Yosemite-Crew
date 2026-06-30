import { Router } from "express";
import { EmergencyTriageController } from "src/controllers/web/emergency-triage.controller";
import { requirePermission } from "src/middlewares/rbac";

const emergencyTriageRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/emergency-triage";

emergencyTriageRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  EmergencyTriageController.list,
);
emergencyTriageRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  EmergencyTriageController.record,
);
emergencyTriageRouter.get(
  `${BASE}/:triageId`,
  requirePermission("appointments:view:any"),
  EmergencyTriageController.get,
);
emergencyTriageRouter.post(
  `${BASE}/:triageId/escalate`,
  requirePermission("appointments:edit:any"),
  EmergencyTriageController.escalate,
);

export default emergencyTriageRouter;
