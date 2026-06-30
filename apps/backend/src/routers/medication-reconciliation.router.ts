import { Router } from "express";
import { MedicationReconciliationController } from "src/controllers/web/medication-reconciliation.controller";
import { requirePermission } from "src/middlewares/rbac";

const medicationReconciliationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/medication-reconciliations";

medicationReconciliationRouter.get(
  BASE,
  requirePermission("appointments:view:any"),
  MedicationReconciliationController.list,
);
medicationReconciliationRouter.post(
  BASE,
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.create,
);
medicationReconciliationRouter.get(
  `${BASE}/:medRecId`,
  requirePermission("appointments:view:any"),
  MedicationReconciliationController.get,
);
medicationReconciliationRouter.put(
  `${BASE}/:medRecId`,
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.update,
);
medicationReconciliationRouter.post(
  `${BASE}/:medRecId/complete`,
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.complete,
);
medicationReconciliationRouter.post(
  `${BASE}/:medRecId/review`,
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.review,
);

export default medicationReconciliationRouter;
