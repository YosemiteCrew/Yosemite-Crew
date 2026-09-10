---
id: backend-api-companion-history
title: Companion History API
slug: /apps/backend/api/companion-history
---

Returns a merged, paginated activity timeline for one patient in the PIMS (Practice Information Management System) — appointments, tasks, form submissions, documents, lab results, and invoices interleaved and sorted most-recent-first. Each entry carries a `type`, a `title`/`subtitle`/`summary`, an optional `actor`, and a `link` back to the underlying record. `types` is a comma-separated filter drawn from `APPOINTMENT`, `TASK`, `FORM_SUBMISSION`, `DOCUMENT`, `LAB_RESULT`, `INVOICE`; `LAB_RESULT` is excluded from the default set and is rejected outright unless the caller holds the `labs:view:any` permission.

**Endpoints**

### GET /pms/organisation/:organisationId/companion/:patientId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Query: `limit`, `cursor`, `types`
- Controller: `CompanionHistoryController.listForCompanion`
- Response: `200`: keys `entries`, `nextCursor`, `summary`; `403`: keys `message` — when `types` requests `LAB_RESULT` without `labs:view:any`
