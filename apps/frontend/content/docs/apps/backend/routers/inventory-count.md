---
id: backend-api-inventory-count
title: Inventory Count API
slug: /apps/backend/api/inventory-count
---

Records physical stock counts against the system count for an inventory item (a cycle count), lists and reconciles them. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordCountSchema`
- Body fields: `inventoryItemId`, `countedBy`, `countedAt`, `systemCount`, `physicalCount`, `notes`
- Controller: `InventoryCountController.record`
- Response: `201`: JSON, `400`: keys `error`

### GET /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `inventoryItemId`, `reconciled`, `fromDate`, `toDate`
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
- Body fields: `reconciledBy`, `notes`
- Controller: `InventoryCountController.reconcile`
- Response: `400`: keys `error`
