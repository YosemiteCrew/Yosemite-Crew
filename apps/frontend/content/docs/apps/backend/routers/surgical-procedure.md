---
id: backend-api-surgical-procedure
title: Surgical Procedure API
slug: /apps/backend/api/surgical-procedure
---

Records surgical procedures performed on a patient during an encounter: the surgeon and assistants, anaesthesia, timing, outcome, complications, instruments used, and specimens sent. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/surgical-procedures

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `outcome` (`SUCCESS`|`COMPLICATION`|`ABANDONED`|`PENDING`)
- Controller: `SurgicalProcedureController.list`

### POST /pms/organisation/:organisationId/surgical-procedures

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `procedureName`, `surgeon`, `assistants` (array), `anesthesiaType` (`GENERAL`|`LOCAL`|`SEDATION`|`EPIDURAL`|`NONE`), `anesthesiaAgent`, `anesthesiaDoseMs`, `startedAt`, `endedAt`, `durationMinutes`, `outcome`, `complications`, `instruments` (array), `specimensSent` (array), `postOpNotes`
- Controller: `SurgicalProcedureController.create`
- Response: `201`: JSON (the created procedure; `performedBy` is set from the session)

### GET /pms/organisation/:organisationId/surgical-procedures/:procedureId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `procedureId`
- Controller: `SurgicalProcedureController.get`

### PUT /pms/organisation/:organisationId/surgical-procedures/:procedureId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `procedureId`
- Body: `UpdateBodySchema`
- Body fields: same as `CreateBodySchema` minus `patientId` and `encounterId` (all optional)
- Controller: `SurgicalProcedureController.update`
