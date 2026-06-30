import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { BodyConditionRecordController } from "src/controllers/web/body-condition-record.controller";

export const bodyConditionRecordRouter = Router({ mergeParams: true });

bodyConditionRecordRouter
  .route("/pms/organisation/:organisationId/body-condition")
  .get(
    requirePermission("companions:view:any"),
    BodyConditionRecordController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    BodyConditionRecordController.create,
  );

bodyConditionRecordRouter
  .route("/pms/organisation/:organisationId/body-condition/trend")
  .get(
    requirePermission("companions:view:any"),
    BodyConditionRecordController.trend,
  );

bodyConditionRecordRouter
  .route("/pms/organisation/:organisationId/body-condition/:recordId")
  .get(
    requirePermission("companions:view:any"),
    BodyConditionRecordController.get,
  )
  .delete(
    requirePermission("companions:edit:any"),
    BodyConditionRecordController.delete,
  );
