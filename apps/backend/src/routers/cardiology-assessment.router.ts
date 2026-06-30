import { Router } from "express";
import { CardiologyAssessmentController } from "src/controllers/web/cardiology-assessment.controller";
import { requirePermission } from "src/middlewares/rbac";

const cardiologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/cardiology-assessments";

cardiologyAssessmentRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  CardiologyAssessmentController.list,
);
cardiologyAssessmentRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.create,
);
cardiologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:view:any"),
  CardiologyAssessmentController.get,
);
cardiologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.update,
);
cardiologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.delete,
);

export default cardiologyAssessmentRouter;
