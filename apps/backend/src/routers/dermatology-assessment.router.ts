import { Router } from "express";
import { DermatologyAssessmentController } from "src/controllers/web/dermatology-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const dermatologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/dermatology-assessments";

dermatologyAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  DermatologyAssessmentController.list,
);
dermatologyAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.create,
);
dermatologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  DermatologyAssessmentController.get,
);
dermatologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.update,
);
dermatologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.delete,
);

export default dermatologyAssessmentRouter;
