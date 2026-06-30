import { Router } from "express";
import { PainAssessmentController } from "src/controllers/web/pain-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const painAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/pain-assessments";

painAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  PainAssessmentController.list,
);
painAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  PainAssessmentController.record,
);
painAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  PainAssessmentController.get,
);
painAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  PainAssessmentController.delete,
);

export default painAssessmentRouter;
