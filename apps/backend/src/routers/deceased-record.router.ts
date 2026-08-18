import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { deceasedRecordController } from "src/controllers/web/deceased-record.controller";

export const deceasedRecordRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/deceased-records";

deceasedRecordRouter.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  deceasedRecordController.create,
);

deceasedRecordRouter.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  deceasedRecordController.list,
);

deceasedRecordRouter.get(
  `${base}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  deceasedRecordController.get,
);

deceasedRecordRouter.get(
  "/pms/organisation/:organisationId/patients/:patientId/deceased-record",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  deceasedRecordController.getByPatient,
);

deceasedRecordRouter.patch(
  `${base}/:recordId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  deceasedRecordController.update,
);
