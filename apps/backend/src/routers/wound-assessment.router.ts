import { Router } from "express";
import { WoundAssessmentController } from "src/controllers/web/wound-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const woundAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/wound-assessments";

woundAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  WoundAssessmentController.list,
);
woundAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WoundAssessmentController.record,
);
woundAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  WoundAssessmentController.get,
);
woundAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WoundAssessmentController.delete,
);

export default woundAssessmentRouter;
