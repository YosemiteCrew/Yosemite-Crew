---
id: backend-api-inventory-count
title: Inventory Count API
slug: /apps/backend/api/inventory-count
---

Records physical stock counts for an inventory item or batch, lists and resolves discrepancies. A batch count captures the current system quantity when it is recorded. Expired batches cannot be counted or adjusted.

## Endpoints

### POST /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordCountSchema`
- Body fields: `inventoryItemId`, `inventoryBatchId` (or `systemCount` for an item-level count), `countedAt`, `physicalCount`, `notes`
- Controller: `InventoryCountController.record`
- Response: `201`: JSON, `400`, `404` (unknown or expired item or batch): keys `error`

### GET /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `inventoryItemId`, `inventoryBatchId`, `reconciled`, `fromDate`, `toDate`
- Controller: `InventoryCountController.list`

### GET /pms/organisation/:organisationId/inventory-counts/unreconciled

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Controller: `InventoryCountController.unreconciled`

### GET /pms/organisation/:organisationId/inventory-counts/:countId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `countId`
- Controller: `InventoryCountController.get`

### POST /pms/organisation/:organisationId/inventory-counts/:countId/reconcile

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `countId`
- Body: `ReconcileSchema`
- Body fields: `resolution` (`STOCK_ADJUSTED` or `NO_CHANGE`), `resolutionNotes`
- Controller: `InventoryCountController.reconcile`
- Response: `200`: JSON, `400`, `404` (unknown count, or a batch that is gone or expired), `409` (already resolved, or stock changed since the count): keys `error`
- A `STOCK_ADJUSTED` resolution sets the batch to the counted quantity, updates the item total and records a stock movement in the same transaction as the resolution.
