import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { TreatmentOutcomeController } from "src/controllers/web/treatment-outcome.controller";

export const treatmentOutcomeRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/treatment-outcomes";

treatmentOutcomeRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    TreatmentOutcomeController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.record,
  );

treatmentOutcomeRouter
  .route(`${BASE}/:outcomeId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    TreatmentOutcomeController.get,
  )
  .patch(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.update,
  );

treatmentOutcomeRouter
  .route(`${BASE}/:outcomeId/resolve`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.resolve,
  );
