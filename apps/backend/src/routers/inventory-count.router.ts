import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { InventoryCountController } from "src/controllers/web/inventory-count.controller";

export const inventoryCountRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/inventory-counts";

inventoryCountRouter
  .route(BASE)
  .post(
    requirePermission("inventory:edit:any"),
    InventoryCountController.record,
  )
  .get(requirePermission("inventory:view:any"), InventoryCountController.list);

inventoryCountRouter.get(
  `${BASE}/unreconciled`,
  requirePermission("inventory:view:any"),
  InventoryCountController.unreconciled,
);

inventoryCountRouter
  .route(`${BASE}/:countId`)
  .get(requirePermission("inventory:view:any"), InventoryCountController.get);

inventoryCountRouter.post(
  `${BASE}/:countId/reconcile`,
  requirePermission("inventory:edit:any"),
  InventoryCountController.reconcile,
);
