import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { drugFormularyController } from "src/controllers/web/drug-formulary.controller";

export const drugFormularyRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/drug-formulary";

drugFormularyRouter.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  drugFormularyController.create,
);

drugFormularyRouter.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  drugFormularyController.list,
);

drugFormularyRouter.get(
  `${base}/:formularyId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  drugFormularyController.get,
);

drugFormularyRouter.patch(
  `${base}/:formularyId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  drugFormularyController.update,
);

drugFormularyRouter.post(
  `${base}/:formularyId/dosages`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  drugFormularyController.addDosage,
);

drugFormularyRouter.delete(
  `${base}/:formularyId/dosages/:dosageId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  drugFormularyController.removeDosage,
);

drugFormularyRouter.delete(
  `${base}/:formularyId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  drugFormularyController.delete,
);
