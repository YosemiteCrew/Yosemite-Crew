import { Router } from "express";
import { PathologySubmissionController } from "src/controllers/web/pathology-submission.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const pathologySubmissionRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/pathology-submissions";

pathologySubmissionRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PathologySubmissionController.list,
);
pathologySubmissionRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.create,
);
pathologySubmissionRouter.get(
  `${BASE}/:submissionId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PathologySubmissionController.get,
);
pathologySubmissionRouter.post(
  `${BASE}/:submissionId/results`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.recordResults,
);
pathologySubmissionRouter.post(
  `${BASE}/:submissionId/review`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.review,
);
pathologySubmissionRouter.put(
  `${BASE}/:submissionId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.update,
);

export default pathologySubmissionRouter;
