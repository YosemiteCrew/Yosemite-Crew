import { Router } from "express";
import { OncologyAssessmentController } from "src/controllers/web/oncology-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const oncologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/oncology-assessments";

oncologyAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  OncologyAssessmentController.list,
);
oncologyAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.create,
);
oncologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  OncologyAssessmentController.get,
);
oncologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.update,
);
oncologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.delete,
);

export default oncologyAssessmentRouter;
