import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { admissionController } from "src/controllers/web/admission.controller";

export const admissionRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/admissions";
const byEncounter =
  "/pms/organisation/:organisationId/encounters/:encounterId/admission";

admissionRouter.post(
  byEncounter,
  requirePermission("companions:edit:any"),
  admissionController.admit,
);

admissionRouter.get(
  byEncounter,
  requirePermission("companions:view:any"),
  admissionController.get,
);

admissionRouter.get(
  base,
  requirePermission("companions:view:any"),
  admissionController.list,
);

admissionRouter.patch(
  byEncounter,
  requirePermission("companions:edit:any"),
  admissionController.update,
);

admissionRouter.post(
  `${byEncounter}/discharge`,
  requirePermission("companions:edit:any"),
  admissionController.discharge,
);
