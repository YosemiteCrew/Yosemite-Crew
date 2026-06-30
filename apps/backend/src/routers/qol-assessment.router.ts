import { Router } from "express";
import { QolAssessmentController } from "src/controllers/web/qol-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const qolAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/qol-assessments";

qolAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  QolAssessmentController.list,
);
qolAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  QolAssessmentController.create,
);
qolAssessmentRouter.get(
  `${BASE}/trend`,
  requirePermission("appointments:view:any"),
  QolAssessmentController.trend,
);
qolAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  QolAssessmentController.get,
);
qolAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  QolAssessmentController.update,
);
qolAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  QolAssessmentController.delete,
);

export default qolAssessmentRouter;
