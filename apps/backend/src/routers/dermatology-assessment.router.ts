import { Router } from "express";
import { DermatologyAssessmentController } from "src/controllers/web/dermatology-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const dermatologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/dermatology-assessments";

dermatologyAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DermatologyAssessmentController.list,
);
dermatologyAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.create,
);
dermatologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DermatologyAssessmentController.get,
);
dermatologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.update,
);
dermatologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DermatologyAssessmentController.delete,
);

export default dermatologyAssessmentRouter;
