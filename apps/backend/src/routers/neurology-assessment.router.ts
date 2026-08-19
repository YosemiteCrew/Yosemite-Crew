import { Router } from "express";
import { NeurologyAssessmentController } from "src/controllers/web/neurology-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const neurologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/neurology-assessments";

neurologyAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NeurologyAssessmentController.list,
);
neurologyAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.create,
);
neurologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  NeurologyAssessmentController.get,
);
neurologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.update,
);
neurologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  NeurologyAssessmentController.delete,
);

export default neurologyAssessmentRouter;
