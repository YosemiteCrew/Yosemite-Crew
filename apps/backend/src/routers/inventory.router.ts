import { Router } from "express";
import {
  InventoryController,
  InventoryVendorController,
  InventoryMetaFieldController,
  InventoryAlertController,
} from "src/controllers/web/inventory.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   ITEMS
   ====================================================== */

// Create item
router.post(
  "/items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.createItem,
);

// Update item
router.patch(
  "/items/:itemId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.updateItem,
);

// Hide / Archive / Activate item
router.post(
  "/items/:itemId/hide",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.hideItem,
);

router.post(
  "/items/:itemId/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.archiveItem,
);

router.post(
  "/items/:itemId/active",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.activeItem,
);

// List items
router.get(
  "/organisation/:organisationId/items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryController.listItems,
);

// Inventory turnover
router.get(
  "/organisation/:organisationId/turnover",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryController.getInventoryTurnOver,
);

// Get item with batches
router.get(
  "/items/:itemId",
  requirePermission("inventory:view:any"),
  InventoryController.getItemWithBatches,
);

/* ======================================================
   BATCHES
   ====================================================== */

// Add batch
router.post(
  "/items/:itemId/batches",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.addBatch,
);

// Update batch
router.patch(
  "/batches/:batchId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.updateBatch,
);

// Delete batch
router.delete(
  "/batches/:batchId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.deleteBatch,
);

/* ======================================================
   STOCK (CONSUME / ADJUST / ALLOCATE)
   ====================================================== */

router.post(
  "/stock/consume",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.consumeStock,
);

router.post(
  "/stock/consume/bulk",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.bulkConsumeStock,
);

router.post(
  "/items/:itemId/adjust",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.adjustStock,
);

router.post(
  "/items/:itemId/allocate",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.allocateStock,
);

router.post(
  "/items/:itemId/release",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.releaseAllocatedStock,
);

/* ======================================================
   VENDORS
   ====================================================== */

// Create vendor
router.post(
  "/vendors",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.createVendor,
);

// List vendors
router.get(
  "/organisation/:organisationId/vendors",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryVendorController.listVendors,
);

// Get vendor
router.get(
  "/vendors/:vendorId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryVendorController.getVendor,
);

// Update vendor
router.patch(
  "/vendors/:vendorId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.updateVendor,
);

// Delete vendor
router.delete(
  "/vendors/:vendorId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.deleteVendor,
);

/* ======================================================
   META FIELDS
   ====================================================== */

router.post(
  "/meta-fields",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.createField,
);

router.get(
  "/meta-fields",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryMetaFieldController.listFields,
);

router.patch(
  "/meta-fields/:fieldId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.updateField,
);

router.delete(
  "/meta-fields/:fieldId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.deleteField,
);

/* ======================================================
   ALERTS
   ====================================================== */

router.get(
  "/organisation/:organisationId/alerts/low-stock",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryAlertController.getLowStockItems,
);

router.get(
  "/organisation/:organisationId/alerts/expiring",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryAlertController.getExpiringItems,
);

export default router;
