import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { AnaesthesiaRecordController } from "src/controllers/web/anaesthesia-record.controller";

export const anaesthesiaRecordRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/anaesthesia";

anaesthesiaRecordRouter
  .route(BASE)
  .get(
    requirePermission("companions:view:any"),
    AnaesthesiaRecordController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.plan,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId`)
  .get(
    requirePermission("companions:view:any"),
    AnaesthesiaRecordController.get,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/start`)
  .post(
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.start,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/intraop-notes`)
  .patch(
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.updateIntraOpNotes,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/complete`)
  .post(
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.complete,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/abort`)
  .post(
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.abort,
  );
