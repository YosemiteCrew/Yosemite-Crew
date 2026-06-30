import { Router } from "express";
import { PathologySubmissionController } from "src/controllers/web/pathology-submission.controller";
import { requirePermission } from "src/middlewares/rbac";

const pathologySubmissionRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/pathology-submissions";

pathologySubmissionRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  PathologySubmissionController.list,
);
pathologySubmissionRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.create,
);
pathologySubmissionRouter.get(
  `${BASE}/:submissionId`,
  requirePermission("appointments:view:any"),
  PathologySubmissionController.get,
);
pathologySubmissionRouter.post(
  `${BASE}/:submissionId/results`,
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.recordResults,
);
pathologySubmissionRouter.post(
  `${BASE}/:submissionId/review`,
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.review,
);
pathologySubmissionRouter.put(
  `${BASE}/:submissionId`,
  requirePermission("appointments:edit:any"),
  PathologySubmissionController.update,
);

export default pathologySubmissionRouter;
