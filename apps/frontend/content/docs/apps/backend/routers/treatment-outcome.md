---
id: backend-api-treatment-outcome
title: Treatment Outcome API
slug: /apps/backend/api/treatment-outcome
---

Records and tracks a patient's clinical treatment outcome (recovered, improved, stable, deteriorated, deceased, referred out, lost to follow-up, or ongoing), with an optional follow-up date and notes, and lets staff mark an outcome resolved. All routes are under the PIMS (Practice Information Management System, the clinic-facing web app) `/pms` namespace and require organisation RBAC (role-based access control) permissions on `companions`.

**Endpoints**

### GET /pms/organisation/:organisationId/treatment-outcomes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `outcomeType`, `resolved`, `encounterId`
- Controller: `TreatmentOutcomeController.list`

### POST /pms/organisation/:organisationId/treatment-outcomes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId`, `episodeOfCareId`, `recordedAt`, `recordedBy`, `outcomeType`, `clinicalNotes`, `followUpDate`, `followUpNotes`
- Controller: `TreatmentOutcomeController.record`
- Response: `201`: JSON, `400`: keys `errors`, `500`: keys `message`

### GET /pms/organisation/:organisationId/treatment-outcomes/:outcomeId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `outcomeId`
- Controller: `TreatmentOutcomeController.get`

### PATCH /pms/organisation/:organisationId/treatment-outcomes/:outcomeId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `outcomeId`
- Body fields: `outcomeType`, `clinicalNotes`, `followUpDate`, `followUpNotes`, `resolved`
- Controller: `TreatmentOutcomeController.update`
- Response: `400`: keys `errors`

### POST /pms/organisation/:organisationId/treatment-outcomes/:outcomeId/resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `outcomeId`
- Controller: `TreatmentOutcomeController.resolve`
