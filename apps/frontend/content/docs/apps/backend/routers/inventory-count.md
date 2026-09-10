---
id: backend-api-inventory-count
title: Inventory Count API
slug: /apps/backend/api/inventory-count
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/inventory-counts/unreconciled

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `InventoryCountController`

### POST /pms/organisation/:organisationId/inventory-counts/:countId/reconcile

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `InventoryCountController`

### POST /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- Permission: `inventory:edit:any`
- Controller: `InventoryCountController`

### GET /pms/organisation/:organisationId/inventory-counts

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `InventoryCountController`

### GET /pms/organisation/:organisationId/inventory-counts/:countId

- Auth: `requireWebAuth`
- Permission: `inventory:view:any`
- Controller: `InventoryCountController`
