import { Router } from "express";
import { BehaviorAssessmentController } from "src/controllers/web/behavior-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const behaviorAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/behavior-assessments";

behaviorAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BehaviorAssessmentController.list,
);
behaviorAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.create,
);
behaviorAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BehaviorAssessmentController.get,
);
behaviorAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.update,
);
behaviorAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.delete,
);

export default behaviorAssessmentRouter;
