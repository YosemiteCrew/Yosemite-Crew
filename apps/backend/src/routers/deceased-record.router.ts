import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { deceasedRecordController } from "src/controllers/web/deceased-record.controller";

export const deceasedRecordRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/deceased-records";

deceasedRecordRouter.post(
  base,
  requirePermission("companions:edit:any"),
  deceasedRecordController.create,
);

deceasedRecordRouter.get(
  base,
  requirePermission("companions:view:any"),
  deceasedRecordController.list,
);

deceasedRecordRouter.get(
  `${base}/:recordId`,
  requirePermission("companions:view:any"),
  deceasedRecordController.get,
);

deceasedRecordRouter.get(
  "/pms/organisation/:organisationId/patients/:patientId/deceased-record",
  requirePermission("companions:view:any"),
  deceasedRecordController.getByPatient,
);

deceasedRecordRouter.patch(
  `${base}/:recordId`,
  requirePermission("companions:edit:any"),
  deceasedRecordController.update,
);
