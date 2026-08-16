import { Router } from "express";
import { PatientTransferController } from "src/controllers/web/patient-transfer.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

export const patientTransferRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/patient-transfers";

patientTransferRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientTransferController.create,
);

patientTransferRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PatientTransferController.list,
);

patientTransferRouter.get(
  `${BASE}/:transferId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PatientTransferController.get,
);

patientTransferRouter.patch(
  `${BASE}/:transferId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientTransferController.update,
);

patientTransferRouter.delete(
  `${BASE}/:transferId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientTransferController.delete,
);
