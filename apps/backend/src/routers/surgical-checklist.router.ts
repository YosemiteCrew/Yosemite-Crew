import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { surgicalChecklistController } from "src/controllers/web/surgical-checklist.controller";

export const surgicalChecklistRouter = Router({ mergeParams: true });

const base = "/pms/organisation/:organisationId/surgical-checklists";
const itemBase = `${base}/:checklistId/items/:itemId`;

surgicalChecklistRouter.post(
  base,
  requirePermission("companions:edit:any"),
  surgicalChecklistController.create,
);

surgicalChecklistRouter.get(
  base,
  requirePermission("companions:view:any"),
  surgicalChecklistController.list,
);

surgicalChecklistRouter.get(
  `${base}/:checklistId`,
  requirePermission("companions:view:any"),
  surgicalChecklistController.get,
);

surgicalChecklistRouter.patch(
  `${base}/:checklistId`,
  requirePermission("companions:edit:any"),
  surgicalChecklistController.update,
);

surgicalChecklistRouter.post(
  `${itemBase}/check`,
  requirePermission("companions:edit:any"),
  surgicalChecklistController.checkItem,
);

surgicalChecklistRouter.post(
  `${itemBase}/uncheck`,
  requirePermission("companions:edit:any"),
  surgicalChecklistController.uncheckItem,
);

surgicalChecklistRouter.delete(
  `${base}/:checklistId`,
  requirePermission("companions:edit:any"),
  surgicalChecklistController.delete,
);
