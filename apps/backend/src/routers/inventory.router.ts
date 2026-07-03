import { Router } from "express";
import {
  InventoryAlertController,
  InventoryController,
  InventoryMetaFieldController,
  InventoryVendorController,
} from "src/controllers/web/inventory.controller";
import { requireWebAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withInventoryItemOrgPermissions,
  withOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   ITEMS
   ====================================================== */

// Inventory item image upload URL
router.post(
  "/organisation/:organisationId/items/upload-url",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.getItemImageUploadUrl,
);

// Create item
router.post(
  "/items",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.createItem,
);

// Update item
router.patch(
  "/items/:itemId",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.updateItem,
);

// Hide / Archive / Activate item
router.post(
  "/items/:itemId/hide",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.hideItem,
);

router.post(
  "/items/:itemId/archive",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.archiveItem,
);

router.post(
  "/items/:itemId/active",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.activeItem,
);

router.patch(
  "/items/:itemId/status",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.toggleItemStatus,
);

// List items
router.get(
  "/organisation/:organisationId/items",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryController.listItems,
);

router.get(
  "/categories",
  requireWebAuth,
  requirePermission("inventory:view:any"),
  InventoryController.getCategories,
);

// Inventory turnover
router.get(
  "/organisation/:organisationId/turnover",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryController.getInventoryTurnOver,
);

// Get item with batches
router.get(
  "/items/:itemId",
  requireWebAuth,
  withInventoryItemOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryController.getItemWithBatches,
);

/* ======================================================
   BATCHES
   ====================================================== */

// Add batch
router.post(
  "/items/:itemId/batches",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.addBatch,
);

// Update batch
router.patch(
  "/batches/:batchId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.updateBatch,
);

// Delete batch
router.delete(
  "/batches/:batchId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.deleteBatch,
);

/* ======================================================
   STOCK (CONSUME / ADJUST / ALLOCATE)
   ====================================================== */

router.post(
  "/stock/consume",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.consumeStock,
);

router.post(
  "/stock/consume/bulk",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.bulkConsumeStock,
);

router.post(
  "/items/:itemId/adjust",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.adjustStock,
);

router.post(
  "/items/:itemId/allocate",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryController.allocateStock,
);

router.post(
  "/items/:itemId/release",
  requireWebAuth,
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
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.createVendor,
);

// List vendors
router.get(
  "/organisation/:organisationId/vendors",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryVendorController.listVendors,
);

// Get vendor
router.get(
  "/vendors/:vendorId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryVendorController.getVendor,
);

// Update vendor
router.patch(
  "/vendors/:vendorId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.updateVendor,
);

// Delete vendor
router.delete(
  "/vendors/:vendorId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryVendorController.deleteVendor,
);

/* ======================================================
   META FIELDS
   ====================================================== */

router.post(
  "/meta-fields",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.createField,
);

router.get(
  "/meta-fields",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryMetaFieldController.listFields,
);

router.patch(
  "/meta-fields/:fieldId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.updateField,
);

router.delete(
  "/meta-fields/:fieldId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  InventoryMetaFieldController.deleteField,
);

/* ======================================================
   ALERTS
   ====================================================== */

router.get(
  "/organisation/:organisationId/alerts/low-stock",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryAlertController.getLowStockItems,
);

router.get(
  "/organisation/:organisationId/alerts/expiring",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  InventoryAlertController.getExpiringItems,
);

export default router;
