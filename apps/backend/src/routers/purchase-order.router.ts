import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { PurchaseOrderController } from "src/controllers/web/purchase-order.controller";
import {
  requirePermission,
  withOrgPermissions,
  withPurchaseOrderDeliveryOrgPermissions,
  withPurchaseOrderOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

router.post(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  PurchaseOrderController.createOrder,
);
router.get(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  PurchaseOrderController.listOrders,
);
router.get(
  "/organisation/:organisationId/outstanding",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  PurchaseOrderController.getOutstandingDeliveries,
);
router.get(
  "/:purchaseOrderId",
  requireWebAuth,
  withPurchaseOrderOrgPermissions(),
  requirePermission("inventory:view:any"),
  PurchaseOrderController.getOrder,
);
router.post(
  "/:purchaseOrderId/confirm",
  requireWebAuth,
  withPurchaseOrderOrgPermissions(),
  requirePermission("inventory:edit:any"),
  PurchaseOrderController.confirmOrder,
);
router.post(
  "/:purchaseOrderId/receive-delivery",
  requireWebAuth,
  withPurchaseOrderOrgPermissions(),
  requirePermission("inventory:edit:any"),
  PurchaseOrderController.receiveDelivery,
);
router.post(
  "/deliveries/:deliveryId/return",
  requireWebAuth,
  withPurchaseOrderDeliveryOrgPermissions(),
  requirePermission("inventory:edit:any"),
  PurchaseOrderController.returnDelivery,
);
router.post(
  "/:purchaseOrderId/cancel",
  requireWebAuth,
  withPurchaseOrderOrgPermissions(),
  requirePermission("inventory:edit:any"),
  PurchaseOrderController.cancelOrder,
);

export default router;
