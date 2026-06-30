import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { TreatmentOutcomeController } from "src/controllers/web/treatment-outcome.controller";

export const treatmentOutcomeRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/treatment-outcomes";

treatmentOutcomeRouter
  .route(BASE)
  .get(
    requirePermission("companions:view:any"),
    TreatmentOutcomeController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.record,
  );

treatmentOutcomeRouter
  .route(`${BASE}/:outcomeId`)
  .get(requirePermission("companions:view:any"), TreatmentOutcomeController.get)
  .patch(
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.update,
  );

treatmentOutcomeRouter
  .route(`${BASE}/:outcomeId/resolve`)
  .post(
    requirePermission("companions:edit:any"),
    TreatmentOutcomeController.resolve,
  );
