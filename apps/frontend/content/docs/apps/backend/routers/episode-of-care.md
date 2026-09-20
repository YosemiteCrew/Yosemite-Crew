---
id: backend-api-episode-of-care
title: Episode Of Care API
slug: /apps/backend/api/episode-of-care
---

Manages the FHIR `EpisodeOfCare` resource: the umbrella record grouping the encounters that make up one course of care for a patient. Internally this resource is called a "case" — the implementation is `CaseController` backed by `CaseEncounterService`, sharing a source file and service with the [Encounter API](./encounter.md). Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Routes addressed by a case id use `withCaseOrgPermissions()`, which derives the organisation from the record itself; a mismatched `organization` reference in the request is rejected with `403`. Single-resource responses are the `EpisodeOfCare` FHIR resource; list responses are a FHIR `Bundle` (`resourceType: "Bundle", type: "searchset", total, entry: [{ resource }]`). Errors come back as `{ message }`.

**Endpoints**

### POST /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Body: `CaseRequestDTO` (a FHIR `EpisodeOfCare` resource; only `resourceType: "EpisodeOfCare"` is checked before the DTO mapper runs)
- Controller: `CaseController.create`
- Response: `201`: the created `EpisodeOfCare` resource

### PATCH /:id

- Auth: `requireWebAuth`
- RBAC: `withCaseOrgPermissions, requirePermission`
- Params: `id`
- Body: `CaseRequestDTO`
- Controller: `CaseController.update`

### GET /:id

- Auth: `requireWebAuth`
- RBAC: `withCaseOrgPermissions, requirePermission`
- Params: `id`
- Controller: `CaseController.getById`

### GET /

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Query: `organization`, `patient`, `parent`, `status`, `appointmentKind` (`OUTPATIENT`, `INPATIENT`)
- Controller: `CaseController.list`
