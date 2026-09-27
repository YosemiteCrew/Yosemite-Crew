---
id: backend-api-inventory-count
title: Inventory Count API
slug: /apps/backend/api/inventory-count
---

Records physical stock counts for an inventory item or batch, lists and resolves discrepancies. A batch count captures the current system quantity when it is recorded.

## Endpoints

### POST /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordCountSchema`
- Body fields: `inventoryItemId`, `inventoryBatchId` (or `systemCount` for an item-level count), `countedAt`, `physicalCount`, `notes`
- Controller: `InventoryCountController.record`
- Response: `201`: JSON, `400`: keys `error`

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
- Response: `400`: keys `error`
