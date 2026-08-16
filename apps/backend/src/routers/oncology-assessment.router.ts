import { Router } from "express";
import { OncologyAssessmentController } from "src/controllers/web/oncology-assessment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const oncologyAssessmentRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/oncology-assessments";

oncologyAssessmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  OncologyAssessmentController.list,
);
oncologyAssessmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.create,
);
oncologyAssessmentRouter.get(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  OncologyAssessmentController.get,
);
oncologyAssessmentRouter.put(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.update,
);
oncologyAssessmentRouter.delete(
  `${BASE}/:assessmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  OncologyAssessmentController.delete,
);

export default oncologyAssessmentRouter;
