---
id: backend-api-search
title: Search API
slug: /apps/backend/api/search
---

Cross-entity search endpoints scoped to an organisation: medications and general inventory items, the shared template library, tasks, documents, billable services, and service packages. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /organisations/:organisationId/medications

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `search`, `category`, `subCategory`, `status`, `page`, `pageSize`
- Controller: `SearchController.searchMedications`
- Response: `400`: keys `message`, `issues`, `200`: keys `items`, `page`, `pageSize`, `total` (inventory items filtered to medication-like items)

### GET /organisations/:organisationId/inventory-items

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `search`, `category`, `subCategory`, `status`, `page`, `pageSize`
- Controller: `SearchController.searchInventoryItems`
- Response: `400`: keys `message`, `issues`, `200`: keys `items`, `page`, `pageSize`, `total`

### GET /organisations/:organisationId/templates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `page`, `pageSize`
- Controller: `SearchController.searchTemplates`
- Response: `401`: keys `message` (no verified caller on the session), `400`: keys `message`, `issues`, `200`: keys `query`, `page`, `pageSize`, `total`, `items`

### GET /organisations/:organisationId/tasks

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `page`, `pageSize`
- Controller: `SearchController.searchTasks`
- Response: `400`: keys `message`, `issues`, `200`: keys `query`, `page`, `pageSize`, `total`, `items`

### GET /organisations/:organisationId/documents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `page`, `pageSize`
- Controller: `SearchController.searchDocuments`
- Response: `400`: keys `message`, `issues`, `200`: keys `query`, `page`, `pageSize`, `total`, `items`

### GET /organisations/:organisationId/services

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `page`, `pageSize`
- Controller: `SearchController.searchServices`
- Response: `400`: keys `message`, `issues`, `200`: keys `query`, `page`, `pageSize`, `total`, `items`

### GET /organisations/:organisationId/packages

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `q`, `page`, `pageSize`
- Controller: `SearchController.searchPackages`
- Response: `400`: keys `message`, `issues`, `200`: keys `query`, `page`, `pageSize`, `total`, `items`
