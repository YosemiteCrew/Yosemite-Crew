import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { surgicalChecklistController } from "src/controllers/web/surgical-checklist.controller";

export const surgicalChecklistRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/surgical-checklists";
const itemBase = `${base}/:checklistId/items/:itemId`;

surgicalChecklistRouter.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  surgicalChecklistController.create,
);

surgicalChecklistRouter.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  surgicalChecklistController.list,
);

surgicalChecklistRouter.get(
  `${base}/:checklistId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  surgicalChecklistController.get,
);

surgicalChecklistRouter.patch(
  `${base}/:checklistId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  surgicalChecklistController.update,
);

surgicalChecklistRouter.post(
  `${itemBase}/check`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  surgicalChecklistController.checkItem,
);

surgicalChecklistRouter.post(
  `${itemBase}/uncheck`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  surgicalChecklistController.uncheckItem,
);

surgicalChecklistRouter.delete(
  `${base}/:checklistId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:edit:any"),
  surgicalChecklistController.delete,
);
