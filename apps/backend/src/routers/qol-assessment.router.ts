import { Router } from "express";
import { QolAssessmentController } from "src/controllers/web/qol-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const qolAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/qol-assessments";

qolAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  QolAssessmentController.list,
);
qolAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  QolAssessmentController.create,
);
qolAssessmentRouter.get(
  `${BASE}/trend`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  QolAssessmentController.trend,
);
qolAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  QolAssessmentController.get,
);
qolAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  QolAssessmentController.update,
);
qolAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  QolAssessmentController.delete,
);

export default qolAssessmentRouter;
