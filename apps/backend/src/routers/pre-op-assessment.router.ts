import { Router } from "express";
import { PreOpAssessmentController } from "src/controllers/web/pre-op-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

export const preOpAssessmentRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/pre-op-assessments";

preOpAssessmentRouter.post(
  BASE,
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.create,
);

preOpAssessmentRouter.get(
  BASE,
  requirePermission("companions:view:any"),
  PreOpAssessmentController.list,
);

preOpAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("companions:view:any"),
  PreOpAssessmentController.get,
);

preOpAssessmentRouter.patch(
  `${BASE}/:assessmentId`,
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.update,
);

preOpAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.delete,
);
