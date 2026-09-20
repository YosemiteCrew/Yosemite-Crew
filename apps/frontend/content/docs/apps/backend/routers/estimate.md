---
id: backend-api-estimate
title: Estimate API
slug: /apps/backend/api/estimate
---

Manages cost estimates presented to a pet parent before treatment: line items, sending, client approval/decline, and converting an approved estimate into billing. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation failures return `400` with `{ error }` (a flattened Zod error); service errors return `{ error: message }` at the service's own status code.

**Endpoints**

### POST /pms/organisation/:organisationId/estimates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateEstimateSchema`
- Body fields: `patientId`, `encounterId`, `validUntil`, `currency`, `notes`, `items` (array of `{ description, quantity, unitPrice, taxRate, notes }`)
- Controller: `estimateController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/estimates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `status` (`DRAFT`, `SENT`, `APPROVED`, `DECLINED`, `EXPIRED`, `CONVERTED`), `patientId`
- Controller: `estimateController.list`

### GET /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Controller: `estimateController.get`

### PATCH /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Body: `UpdateEstimateSchema`
- Body fields: `validUntil`, `currency`, `notes`, `items`
- Controller: `estimateController.update`

### POST /pms/organisation/:organisationId/estimates/:estimateId/send

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Controller: `estimateController.markSent`

### POST /pms/organisation/:organisationId/estimates/:estimateId/approve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Body: `{ reason?: string }`
- Controller: `estimateController.approve`

### POST /pms/organisation/:organisationId/estimates/:estimateId/convert

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Controller: `estimateController.convert`

### POST /pms/organisation/:organisationId/estimates/:estimateId/decline

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Body: `{ reason?: string }`
- Controller: `estimateController.decline`

### DELETE /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `estimateId`
- Controller: `estimateController.delete`
- Response: `204`: (no content)
