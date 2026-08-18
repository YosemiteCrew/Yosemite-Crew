import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { AnaesthesiaRecordController } from "src/controllers/web/anaesthesia-record.controller";

export const anaesthesiaRecordRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/anaesthesia";

anaesthesiaRecordRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    AnaesthesiaRecordController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.plan,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    AnaesthesiaRecordController.get,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/start`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.start,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/intraop-notes`)
  .patch(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.updateIntraOpNotes,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/complete`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.complete,
  );

anaesthesiaRecordRouter
  .route(`${BASE}/:recordId/abort`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    AnaesthesiaRecordController.abort,
  );
