import { Router } from "express";
import { BehaviorAssessmentController } from "src/controllers/web/behavior-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const behaviorAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/behavior-assessments";

behaviorAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  BehaviorAssessmentController.list,
);
behaviorAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.create,
);
behaviorAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  BehaviorAssessmentController.get,
);
behaviorAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.update,
);
behaviorAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  BehaviorAssessmentController.delete,
);

export default behaviorAssessmentRouter;
