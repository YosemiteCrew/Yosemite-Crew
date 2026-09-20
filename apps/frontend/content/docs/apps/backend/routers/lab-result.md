---
id: backend-api-lab-result
title: Lab Result API
slug: /apps/backend/api/lab-result
---

Lists and fetches lab results (and their PDF reports) stored for a given lab `:provider` within an organisation. Shares its `/v1/labs` mount with the [Lab Order API](./lab-order.md), which owns the `/orders`, `/tests`, `/ivls`, and `/census` sub-paths; this router owns `/results`. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions. The PDF-returning routes only support the `IDEXX` provider and stream `application/pdf` directly rather than JSON.

**Endpoints**

### GET /pms/organisation/:organisationId/:provider/results

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`
- Query: `orderId`, `patientId`, `limit`
- Controller: `LabResultController.list`

### GET /pms/organisation/:organisationId/:provider/results/search

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider` (must be `IDEXX`)
- Query: `orderId`, `patientId`, `limit`
- Controller: `LabResultController.search`
- Response: `400`: keys `message` (when `provider` is not `IDEXX`)

### GET /pms/organisation/:organisationId/:provider/results/pdf

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider` (must be `IDEXX`)
- Query: `resultIds` (comma-separated, at least one required)
- Controller: `LabResultController.getCombinedPdf`
- Response: `200`: PDF binary (`Content-Type: application/pdf`, merged single-file download of every requested result), `400`: keys `message`, `404`: keys `message` (a result id isn't stored for this organisation), `502`: keys `message` (the provider's PDF wasn't available)

### GET /pms/organisation/:organisationId/:provider/results/:resultId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider`, `resultId`
- Controller: `LabResultController.get`
- Response: `200`: JSON (the stored result), `404`: keys `message`

### GET /pms/organisation/:organisationId/:provider/results/:resultId/pdf

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider` (must be `IDEXX`), `resultId`
- Controller: `LabResultController.getPdf`
- Response: `200`: PDF binary (`Content-Type: application/pdf`), `404`: keys `message` (result not stored), `500`: keys `message` (PDF unavailable)

### GET /pms/organisation/:organisationId/:provider/results/:resultId/notifications/pdf

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `provider` (must be `IDEXX`), `resultId`
- Controller: `LabResultController.getNotificationsPdf`
- Response: `200`: PDF binary (`Content-Type: application/pdf`, the result's notifications report), `404`: keys `message` (result not stored), `500`: keys `message` (PDF unavailable)
