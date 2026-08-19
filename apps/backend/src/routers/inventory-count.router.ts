import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { InventoryCountController } from "src/controllers/web/inventory-count.controller";

export const inventoryCountRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/inventory-counts";

inventoryCountRouter
  .route(BASE)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("inventory:edit:any"),
    InventoryCountController.record,
  )
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("inventory:view:any"),
    InventoryCountController.list,
  );

inventoryCountRouter.get(
  `${BASE}/unreconciled`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryCountController.unreconciled,
);

inventoryCountRouter
  .route(`${BASE}/:countId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("inventory:view:any"),
    InventoryCountController.get,
  );

inventoryCountRouter.post(
  `${BASE}/:countId/reconcile`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryCountController.reconcile,
);
