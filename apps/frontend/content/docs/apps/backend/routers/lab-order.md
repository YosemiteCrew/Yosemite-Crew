---
id: backend-api-lab-order
title: Lab Order API
slug: /apps/backend/api/lab-order
---

Manages external lab orders and in-house analyzer (IVLS) census for a given lab `:provider` (for example IDEXX) within an organisation: listing/searching orders, browsing the provider's test catalog, listing IVLS devices, managing the IVLS census of patients currently on an analyzer, and creating/reading/updating/cancelling orders. Shares its `/v1/labs` mount with the [Lab Result API](./lab-result.md), which owns the `/results` sub-paths; this router owns `/orders`, `/tests`, `/ivls`, and `/census`. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/:provider/orders

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `LabOrderController.listOrders`
- Response: `200`: keys `orders`

### POST /pms/organisation/:organisationId/:provider/orders/search

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body: `ListOrdersSearchBodySchema`
- Body fields: `appointmentId`, `patientId`, `status` (`CREATED`|`SUBMITTED`|`AT_THE_LAB`|`PARTIAL`|`RUNNING`|`COMPLETE`|`CANCELLED`|`ERROR`), `limit` (max 200)
- Controller: `LabOrderController.searchOrders`
- Response: `200`: keys `orders`, `400`: keys `message`

### GET /pms/organisation/:organisationId/:provider/tests

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Query: `query`, `limit`, `page`, `codes` (comma-separated)
- Controller: `LabOrderController.listProviderTests`

### POST /pms/organisation/:organisationId/:provider/tests

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body fields: `query`, `limit`, `page`, `codes` (array) — same handler as the GET route above, registered again for callers that prefer a request body
- Controller: `LabOrderController.listProviderTests`

### GET /pms/organisation/:organisationId/:provider/ivls/devices

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `LabCensusController.listIvlsDevices`

### GET /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `LabCensusController.listCensus`

### DELETE /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Controller: `LabCensusController.deleteCensus`

### GET /pms/organisation/:organisationId/:provider/census/:censusId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `censusId`
- Controller: `LabCensusController.getCensusById`

### DELETE /pms/organisation/:organisationId/:provider/census/:censusId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `censusId`
- Controller: `LabCensusController.deleteCensusById`

### GET /pms/organisation/:organisationId/:provider/census/patient/:patientId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `patientId`
- Controller: `LabCensusController.getCensusPatient`
- Response: `405`: keys `message` — the handler reads `patientId` only from the request body, not from this route's `:patientId` path segment, so a plain GET always 405s with "Use POST with patientId in request body."; use the POST route below instead

### POST /pms/organisation/:organisationId/:provider/census/patient

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body fields: `patientId`
- Controller: `LabCensusController.getCensusPatient`
- Response: `400`: keys `message` (when `patientId` is missing)

### POST /pms/organisation/:organisationId/:provider/census

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body fields: `patientId`, `parentId`, `veterinarian`, `ivls` (array of `{ serialNumber }`)
- Controller: `LabCensusController.addCensusPatient`

### DELETE /pms/organisation/:organisationId/:provider/census/patient/:patientId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `patientId`
- Controller: `LabCensusController.deleteCensusPatient`

### POST /pms/organisation/:organisationId/:provider/orders

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Body fields: `patientId`, `appointmentId`, `tests` (array), `modality` (`IN_HOUSE`|`REFERENCE_LAB`), `ivls` (array of `{ serialNumber }`), `veterinarian`, `technician`, `notes`, `specimenCollectionDate`
- Controller: `LabOrderController.createIdexxOrder`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `idexxOrderId`
- Controller: `LabOrderController.getOrder`

### PUT /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `idexxOrderId`
- Body fields: `tests` (array), `modality` (`IN_HOUSE`|`REFERENCE_LAB`), `ivls` (array of `{ serialNumber }`), `veterinarian`, `technician`, `notes`, `specimenCollectionDate`
- Controller: `LabOrderController.updateOrder`

### DELETE /pms/organisation/:organisationId/:provider/orders/:idexxOrderId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `idexxOrderId`
- Controller: `LabOrderController.cancelOrder`
