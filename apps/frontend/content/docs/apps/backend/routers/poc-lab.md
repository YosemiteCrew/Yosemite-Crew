---
id: backend-api-poc-lab
title: POC Lab API
slug: /apps/backend/api/poc-lab
---

Manages point-of-care (POC) lab results — bloodwork and other tests run in-clinic on an analyzer rather than sent to an outside laboratory (for example CBC, blood chemistry, urinalysis, fecal float, cytology, coagulation, electrolytes, thyroid panel, cortisol, glucose curve, or blood gas). Each result carries one or more named readings with an optional reference range and abnormal flag. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/poc-lab

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `testType`
- Controller: `PocLabController.list`

### POST /pms/organisation/:organisationId/poc-lab

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `conductedAt`, `testType`, `analyzerName`, `sampleType`, `results` (array of `{ name, value, unit, referenceRangeLow, referenceRangeHigh, flag }`, at least one required; `flag` is one of `H`, `L`, `HH`, `LL`, `N`), `overallInterpretation`, `abnormalFlags`, `criticalFlags`, `followUpRecommended`, `notes` (`patientId`, `conductedAt`, `testType`, and `results` are required, the rest optional)
- Controller: `PocLabController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `PocLabController.get`

### PUT /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Body: `UpdateBodySchema`
- Body fields: `overallInterpretation`, `abnormalFlags`, `criticalFlags`, `followUpRecommended`, `notes` (all optional; the raw test results and test type cannot be changed after creation)
- Controller: `PocLabController.update`

### DELETE /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `PocLabController.delete`
- Response: `204`: JSON
