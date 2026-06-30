import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { drugFormularyController } from "src/controllers/web/drug-formulary.controller";

export const drugFormularyRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/drug-formulary";

drugFormularyRouter.post(
  base,
  requirePermission("inventory:edit:any"),
  drugFormularyController.create,
);

drugFormularyRouter.get(
  base,
  requirePermission("inventory:view:any"),
  drugFormularyController.list,
);

drugFormularyRouter.get(
  `${base}/:formularyId`,
  requirePermission("inventory:view:any"),
  drugFormularyController.get,
);

drugFormularyRouter.patch(
  `${base}/:formularyId`,
  requirePermission("inventory:edit:any"),
  drugFormularyController.update,
);

drugFormularyRouter.post(
  `${base}/:formularyId/dosages`,
  requirePermission("inventory:edit:any"),
  drugFormularyController.addDosage,
);

drugFormularyRouter.delete(
  `${base}/:formularyId/dosages/:dosageId`,
  requirePermission("inventory:edit:any"),
  drugFormularyController.removeDosage,
);

drugFormularyRouter.delete(
  `${base}/:formularyId`,
  requirePermission("inventory:edit:any"),
  drugFormularyController.delete,
);
