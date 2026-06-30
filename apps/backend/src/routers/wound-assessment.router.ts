import { Router } from "express";
import { WoundAssessmentController } from "src/controllers/web/wound-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const woundAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/wound-assessments";

woundAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  WoundAssessmentController.list,
);
woundAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  WoundAssessmentController.record,
);
woundAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  WoundAssessmentController.get,
);
woundAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  WoundAssessmentController.delete,
);

export default woundAssessmentRouter;
