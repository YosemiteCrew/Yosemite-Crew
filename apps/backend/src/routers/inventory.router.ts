import { Router } from "express";
import {
  InventoryController,
  InventoryVendorController,
  InventoryMetaFieldController,
  InventoryAlertController,
} from "src/controllers/web/inventory.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

// ─────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────
router.post("/items", authorizeCognito, InventoryController.createItem);
router.patch(
  "/items/:itemId",
  authorizeCognito,
  InventoryController.updateItem,
);
router.post(
  "/items/:itemId/hide",
  authorizeCognito,
  InventoryController.hideItem,
);
router.post(
  "/items/:itemId/archive",
  authorizeCognito,
  InventoryController.archiveItem,
);

router.get(
  "/organisation/:organisationId/items",
  authorizeCognito,
  InventoryController.listItems,
);

router.get(
  "/items/:itemId",
  authorizeCognito,
  InventoryController.getItemWithBatches,
);

// ─────────────────────────────────────────────
// BATCHES
// ─────────────────────────────────────────────
router.post(
  "/items/:itemId/batches",
  authorizeCognito,
  InventoryController.addBatch,
);

router.patch(
  "/batches/:batchId",
  authorizeCognito,
  InventoryController.updateBatch,
);

router.delete(
  "/batches/:batchId",
  authorizeCognito,
  InventoryController.deleteBatch,
);

// ─────────────────────────────────────────────
// STOCK (CONSUME / ADJUST / ALLOCATE)
// ─────────────────────────────────────────────
router.post(
  "/stock/consume",
  authorizeCognito,
  InventoryController.consumeStock,
);

router.post(
  "/items/:itemId/adjust",
  authorizeCognito,
  InventoryController.adjustStock,
);

router.post(
  "/items/:itemId/allocate",
  authorizeCognito,
  InventoryController.allocateStock,
);

router.post(
  "/items/:itemId/release",
  authorizeCognito,
  InventoryController.releaseAllocatedStock,
);

// ─────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────
router.post(
  "/vendors",
  authorizeCognito,
  InventoryVendorController.createVendor,
);

router.get(
  "/organisation/:organisationId/vendors",
  authorizeCognito,
  InventoryVendorController.listVendors,
);

router.get(
  "/vendors/:vendorId",
  authorizeCognito,
  InventoryVendorController.getVendor,
);

router.patch(
  "/vendors/:vendorId",
  authorizeCognito,
  InventoryVendorController.updateVendor,
);

router.delete(
  "/vendors/:vendorId",
  authorizeCognito,
  InventoryVendorController.deleteVendor,
);

// ─────────────────────────────────────────────
// META FIELDS
// ─────────────────────────────────────────────
router.post(
  "/meta-fields",
  authorizeCognito,
  InventoryMetaFieldController.createField,
);

router.get(
  "/meta-fields",
  authorizeCognito,
  InventoryMetaFieldController.listFields,
);

router.patch(
  "/meta-fields/:fieldId",
  authorizeCognito,
  InventoryMetaFieldController.updateField,
);

router.delete(
  "/meta-fields/:fieldId",
  authorizeCognito,
  InventoryMetaFieldController.deleteField,
);

// ─────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────
router.get(
  "/organisation/:organisationId/alerts/low-stock",
  authorizeCognito,
  InventoryAlertController.getLowStockItems,
);

router.get(
  "/organisation/:organisationId/alerts/expiring",
  authorizeCognito,
  InventoryAlertController.getExpiringItems,
);

export default router;
