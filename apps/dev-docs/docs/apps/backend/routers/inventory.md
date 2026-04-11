---
id: backend-api-inventory
title: Inventory API
slug: /apps/backend/api/inventory
---

**Endpoints**

### POST /items
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `CreateInventoryItemInput`
- Controller: `InventoryController.createItem`
- Response: `201`: JSON

### PATCH /items/:itemId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Body: `UpdateInventoryItemInput`
- Controller: `InventoryController.updateItem`

### POST /items/:itemId/hide
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Controller: `InventoryController.hideItem`

### POST /items/:itemId/archive
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Controller: `InventoryController.archiveItem`

### POST /items/:itemId/active
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Controller: `InventoryController.activeItem`

### GET /organisation/:organisationId/items
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `InventoryController.listItems`

### GET /organisation/:organisationId/turnover
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `from`, `to`
- Controller: `InventoryController.getInventoryTurnOver`
- Response: `200`: keys `from`, `items`, `to`, `500`: keys `message`

### GET /items/:itemId
- Auth: `none`
- RBAC: `requirePermission`
- Params: `itemId`
- Controller: `InventoryController.getItemWithBatches`

### POST /items/:itemId/batches
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Body: `InventoryBatchInput`
- Controller: `InventoryController.addBatch`

### PATCH /batches/:batchId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `batchId`
- Body: `Partial<InventoryBatchInput`
- Controller: `InventoryController.updateBatch`

### DELETE /batches/:batchId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `batchId`
- Controller: `InventoryController.deleteBatch`

### POST /stock/consume
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `ConsumeStockInput`
- Controller: `InventoryController.consumeStock`

### POST /stock/consume/bulk
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `BulkConsumeStockInput`
- Controller: `InventoryController.bulkConsumeStock`

### POST /items/:itemId/adjust
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Body: `{ newOnHand: number; reason: string }`
- Controller: `InventoryController.adjustStock`

### POST /items/:itemId/allocate
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Body: `{ quantity: number; referenceId: string }`
- Controller: `InventoryController.allocateStock`

### POST /items/:itemId/release
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `itemId`
- Body: `{ quantity: number; referenceId: string }`
- Controller: `InventoryController.releaseAllocatedStock`

### POST /vendors
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `InventoryVendorController.createVendor`

### GET /organisation/:organisationId/vendors
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `InventoryVendorController.listVendors`

### GET /vendors/:vendorId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `vendorId`
- Controller: `InventoryVendorController.getVendor`

### PATCH /vendors/:vendorId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `vendorId`
- Controller: `InventoryVendorController.updateVendor`

### DELETE /vendors/:vendorId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `vendorId`
- Controller: `InventoryVendorController.deleteVendor`

### POST /meta-fields
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `InventoryMetaFieldController.createField`

### GET /meta-fields
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Controller: `InventoryMetaFieldController.listFields`

### PATCH /meta-fields/:fieldId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `fieldId`
- Controller: `InventoryMetaFieldController.updateField`

### DELETE /meta-fields/:fieldId
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `fieldId`
- Controller: `InventoryMetaFieldController.deleteField`

### GET /organisation/:organisationId/alerts/low-stock
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `InventoryAlertController.getLowStockItems`

### GET /organisation/:organisationId/alerts/expiring
- Auth: `authorizeCognito`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `InventoryAlertController.getExpiringItems`
