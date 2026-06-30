import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { PatientFlagController } from "src/controllers/web/patient-flag.controller";

export const patientFlagRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/patient-flags";

patientFlagRouter.post(
  BASE,
  requirePermission("companions:edit:any"),
  PatientFlagController.create,
);

patientFlagRouter.get(
  BASE,
  requirePermission("companions:view:any"),
  PatientFlagController.list,
);

patientFlagRouter.get(
  `${BASE}/:flagId`,
  requirePermission("companions:view:any"),
  PatientFlagController.get,
);

patientFlagRouter.patch(
  `${BASE}/:flagId`,
  requirePermission("companions:edit:any"),
  PatientFlagController.update,
);

patientFlagRouter.post(
  `${BASE}/:flagId/resolve`,
  requirePermission("companions:edit:any"),
  PatientFlagController.resolve,
);
