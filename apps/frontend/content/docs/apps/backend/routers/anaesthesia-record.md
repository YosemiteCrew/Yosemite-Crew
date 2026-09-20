---
id: backend-api-anaesthesia-record
title: Anaesthesia Record API
slug: /apps/backend/api/anaesthesia-record
---

Manages anaesthesia records for a patient through their lifecycle: planning, starting, adding intra-operative notes, and completing or aborting the anaesthetic, recorded by the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `companions` permission pair. Every route validates its params/body/query with Zod and returns `400` with keys `error` (the Zod issue list) on failure; an unhandled service failure is not caught locally.

**Endpoints**

### GET /pms/organisation/:organisationId/anaesthesia

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `appointmentId`, `status`
- Controller: `AnaesthesiaRecordController.list`

### POST /pms/organisation/:organisationId/anaesthesia

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `PlanSchema`
- Body fields: `patientId`, `encounterId`, `appointmentId`, `surgicalProcedureId`, `anaesthetistId`, `anesthesiaType`, `inductionAgent`, `maintenanceAgent`, `oxygenFlowLpm`, `preOpAssessment`, `preMedications`
- Controller: `AnaesthesiaRecordController.plan`
- Response: `201`: JSON (created anaesthesia record), `400`: keys `error`

### GET /pms/organisation/:organisationId/anaesthesia/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `AnaesthesiaRecordController.get`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/start

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `AnaesthesiaRecordController.start`

### PATCH /pms/organisation/:organisationId/anaesthesia/:recordId/intraop-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body: `IntraOpNotesSchema`
- Body fields: `notes`
- Controller: `AnaesthesiaRecordController.updateIntraOpNotes`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body: `CompleteSchema`
- Body fields: `complications`, `recoveryNotes`
- Controller: `AnaesthesiaRecordController.complete`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/abort

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body: `AbortSchema`
- Body fields: `complications`
- Controller: `AnaesthesiaRecordController.abort`
