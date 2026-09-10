---
id: backend-api-patient-flag
title: Patient Flag API
slug: /apps/backend/api/patient-flag
---

Manages clinical or administrative flags on a patient record for the PIMS (Practice Information Management System, the clinic-facing web app) — for example aggression, escape risk, an allergy warning, or a VIP or billing note — each with a severity and a resolve action. All routes require organisation RBAC (role-based access control) permissions on `companions`.

**Endpoints**

### POST /pms/organisation/:organisationId/patient-flags

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `flagType`, `severity?`, `title`, `description?`, `createdBy?`
- Controller: `PatientFlagController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/patient-flags

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `flagType?`, `severity?`, `isActive?`
- Controller: `PatientFlagController.list`

### GET /pms/organisation/:organisationId/patient-flags/:flagId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `flagId`
- Controller: `PatientFlagController.get`

### PATCH /pms/organisation/:organisationId/patient-flags/:flagId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `flagId`
- Body fields: `flagType?`, `severity?`, `title?`, `description?`
- Controller: `PatientFlagController.update`

### POST /pms/organisation/:organisationId/patient-flags/:flagId/resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `flagId`
- Body: `{ resolvedBy?: string }`
- Controller: `PatientFlagController.resolve`
