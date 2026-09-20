---
id: backend-api-deceased-record
title: Deceased Record API
slug: /apps/backend/api/deceased-record
---

Records and retrieves a patient's deceased record in the PIMS (Practice Information Management System) — date and cause of death, body condition and disposition, necropsy status, and owner-notification timestamp. `causeOfDeathType` and `bodyDisposition` are closed enums (see the controller for the full value sets). Validation errors on create and update return a `{ error }` envelope (via Zod's `flattenError`), not the `{ message }` shape used elsewhere in the backend.

**Endpoints**

### POST /pms/organisation/:organisationId/deceased-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `deceasedAt`, `causeOfDeathType`, `causeOfDeathDetail`, `bodyWeightKg`, `bodyConditionScore`, `necropsyRequested`, `necropsyFacility`, `bodyDisposition`, `ownerNotifiedAt`, `certifiedBy`, `notes`
- Controller: `deceasedRecordController.create`
- Response: `201`: JSON — the created record; `400`: keys `error`

### GET /pms/organisation/:organisationId/deceased-records

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `causeOfDeathType`
- Controller: `deceasedRecordController.list`

### GET /pms/organisation/:organisationId/deceased-records/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `deceasedRecordController.get`

### GET /pms/organisation/:organisationId/patients/:patientId/deceased-record

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `patientId`
- Controller: `deceasedRecordController.getByPatient`

### PATCH /pms/organisation/:organisationId/deceased-records/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body fields: `deceasedAt`, `causeOfDeathType`, `causeOfDeathDetail`, `bodyWeightKg`, `bodyConditionScore`, `necropsyRequested`, `necropsyFacility`, `bodyDisposition`, `ownerNotifiedAt`, `certifiedBy`, `notes`
- Controller: `deceasedRecordController.update`
- Response: `400`: keys `error`
