import { Router } from "express";
import { PatientTransferController } from "src/controllers/web/patient-transfer.controller";
import { requirePermission } from "src/middlewares/rbac";

export const patientTransferRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/patient-transfers";

patientTransferRouter.post(
  BASE,
  requirePermission("companions:edit:any"),
  PatientTransferController.create,
);

patientTransferRouter.get(
  BASE,
  requirePermission("companions:view:any"),
  PatientTransferController.list,
);

patientTransferRouter.get(
  `${BASE}/:transferId`,
  requirePermission("companions:view:any"),
  PatientTransferController.get,
);

patientTransferRouter.patch(
  `${BASE}/:transferId`,
  requirePermission("companions:edit:any"),
  PatientTransferController.update,
);

patientTransferRouter.delete(
  `${BASE}/:transferId`,
  requirePermission("companions:edit:any"),
  PatientTransferController.delete,
);
