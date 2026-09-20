---
id: backend-api-encounter
title: Encounter API
slug: /apps/backend/api/encounter
---

Manages the FHIR `Encounter` resource: a single visit or inpatient stay, including admission-unit assignment, starting/discharging, and the ready-for-discharge flag. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Routes addressed by an encounter id use `withEncounterOrgPermissions()`, which derives the organisation from the encounter record itself rather than trusting a client-supplied one; a mismatched `organization` reference in the request body or query is rejected with `403`. Single-resource responses are the `Encounter` FHIR resource; list responses are a FHIR `Bundle` (`resourceType: "Bundle", type: "searchset", total, entry: [{ resource }]`). Errors come back as `{ message }`.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `EncounterRequestDTO` (a FHIR `Encounter` resource; only `resourceType: "Encounter"` is checked before the DTO mapper runs)
- Controller: `EncounterController.create`
- Response: `201`: the created `Encounter` resource

### PATCH /:id

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Body: `EncounterRequestDTO`
- Controller: `EncounterController.update`

### POST /:id/$discharge

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `Parameters` resource; recognised parameter names: `dischargedAt`, `periodEnd`, `overrideReason`
- Controller: `EncounterController.discharge`

### POST /:id/$assign-unit

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `Parameters` resource; recognised parameter names: `unitId`, `assignedBy`, `reason`, `assignedAt`
- Controller: `EncounterController.assignUnit`

### GET /:id/$unit-assignments

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Controller: `EncounterController.listUnitAssignments`
- Response: `200`: FHIR `Parameters` resource, one `part` per unit assignment (`id`, `encounterId`, `admissionId`, `unitId`, `assignedAt`, `releasedAt`, `assignedBy`, `reason`, `createdAt`, `updatedAt`)

### GET /:id/$admission-unit-assignments

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Controller: `EncounterController.listAdmissionUnitAssignments`
- Response: `200`: FHIR `Parameters` resource, same shape as `$unit-assignments`

### POST /:id/$start

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Body: FHIR `Parameters` resource; recognised parameter name: `startedAt`
- Controller: `EncounterController.start`

### POST /:id/$ready-for-discharge

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Controller: `EncounterController.readyForDischarge`

### POST /:id/$undo-ready-for-discharge

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Controller: `EncounterController.undoReadyForDischarge`

### GET /$active-inpatients

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organization`
- Controller: `EncounterController.listActiveInpatients`

### GET /:id

- Auth: `requireWebAuth`
- RBAC: `withEncounterOrgPermissions, requirePermission`
- Params: `id`
- Controller: `EncounterController.getById`

### GET /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organization`, `episodeofcare`, `patient`, `parent`, `status`, `appointmentKind` (`OUTPATIENT`, `INPATIENT`)
- Controller: `EncounterController.list`
