import { Router } from "express";
import { PreOpAssessmentController } from "src/controllers/web/pre-op-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

export const preOpAssessmentRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/pre-op-assessments";

preOpAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.create,
);

preOpAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PreOpAssessmentController.list,
);

preOpAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PreOpAssessmentController.get,
);

preOpAssessmentRouter.patch(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.update,
);

preOpAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PreOpAssessmentController.delete,
);
