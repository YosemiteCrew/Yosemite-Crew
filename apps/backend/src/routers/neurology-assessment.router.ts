import { Router } from "express";
import { NeurologyAssessmentController } from "src/controllers/web/neurology-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const neurologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/neurology-assessments";

neurologyAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  NeurologyAssessmentController.list,
);
neurologyAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.create,
);
neurologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  NeurologyAssessmentController.get,
);
neurologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.update,
);
neurologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.delete,
);

export default neurologyAssessmentRouter;
