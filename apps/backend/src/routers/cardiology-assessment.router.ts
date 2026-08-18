import { Router } from "express";
import { CardiologyAssessmentController } from "src/controllers/web/cardiology-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const cardiologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/cardiology-assessments";

cardiologyAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CardiologyAssessmentController.list,
);
cardiologyAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.create,
);
cardiologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  CardiologyAssessmentController.get,
);
cardiologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.update,
);
cardiologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  CardiologyAssessmentController.delete,
);

export default cardiologyAssessmentRouter;
