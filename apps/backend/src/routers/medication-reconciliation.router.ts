import { Router } from "express";
import { MedicationReconciliationController } from "src/controllers/web/medication-reconciliation.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const medicationReconciliationRouter = Router({ mergeParams: true });
const BASE = "/pms/organisation/:organisationId/medication-reconciliations";

medicationReconciliationRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MedicationReconciliationController.list,
);
medicationReconciliationRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.create,
);
medicationReconciliationRouter.get(
  `${BASE}/:medRecId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  MedicationReconciliationController.get,
);
medicationReconciliationRouter.put(
  `${BASE}/:medRecId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.update,
);
medicationReconciliationRouter.post(
  `${BASE}/:medRecId/complete`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.complete,
);
medicationReconciliationRouter.post(
  `${BASE}/:medRecId/review`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  MedicationReconciliationController.review,
);

export default medicationReconciliationRouter;
