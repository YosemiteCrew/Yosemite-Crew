import { Router } from "express";
import { PainAssessmentController } from "src/controllers/web/pain-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const painAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/pain-assessments";

painAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PainAssessmentController.list,
);
painAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PainAssessmentController.record,
);
painAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PainAssessmentController.get,
);
painAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PainAssessmentController.delete,
);

export default painAssessmentRouter;
