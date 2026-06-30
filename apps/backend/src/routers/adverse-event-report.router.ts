import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { AdverseEventReportController } from "src/controllers/web/adverse-event-report.controller";

export const adverseEventReportRouter = Router({ mergeParams: true });

adverseEventReportRouter
  .route("/pms/organisation/:organisationId/adverse-events")
  .get(
    requirePermission("companions:view:any"),
    AdverseEventReportController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    AdverseEventReportController.create,
  );

adverseEventReportRouter
  .route("/pms/organisation/:organisationId/adverse-events/:reportId")
  .get(
    requirePermission("companions:view:any"),
    AdverseEventReportController.get,
  );

adverseEventReportRouter
  .route("/pms/organisation/:organisationId/adverse-events/:reportId/status")
  .patch(
    requirePermission("companions:edit:any"),
    AdverseEventReportController.updateStatus,
  );
