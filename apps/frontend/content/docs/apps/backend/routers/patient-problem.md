---
id: backend-api-patient-problem
title: Patient Problem API
slug: /apps/backend/api/patient-problem
---

Manages a patient's problem list for the PIMS (Practice Information Management System, the clinic-facing web app): active, inactive, or resolved clinical problems with an optional code, severity, and onset date, plus a dedicated resolve action. All routes require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-problems

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `status?`
- Controller: `PatientProblemController.list`

### POST /pms/organisation/:organisationId/patient-problems

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `name`, `codeSystem?`, `code?`, `severity?`, `onsetDate?`, `notes?`
- Controller: `PatientProblemController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/patient-problems/:problemId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `problemId`
- Controller: `PatientProblemController.get`

### PUT /pms/organisation/:organisationId/patient-problems/:problemId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `problemId`
- Body fields: `name?`, `codeSystem?`, `code?`, `status?`, `severity?`, `onsetDate?`, `resolvedDate?`, `notes?`
- Controller: `PatientProblemController.update`

### POST /pms/organisation/:organisationId/patient-problems/:problemId/resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `problemId`
- Body fields: `resolvedDate?`
- Controller: `PatientProblemController.resolve`
