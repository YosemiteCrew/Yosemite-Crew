import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PatientFlagController } from "src/controllers/web/patient-flag.controller";

export const patientFlagRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/patient-flags";

patientFlagRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientFlagController.create,
);

patientFlagRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PatientFlagController.list,
);

patientFlagRouter.get(
  `${BASE}/:flagId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PatientFlagController.get,
);

patientFlagRouter.patch(
  `${BASE}/:flagId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientFlagController.update,
);

patientFlagRouter.post(
  `${BASE}/:flagId/resolve`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  PatientFlagController.resolve,
);
