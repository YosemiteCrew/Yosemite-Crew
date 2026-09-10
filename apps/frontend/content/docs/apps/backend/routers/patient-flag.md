---
id: backend-api-patient-flag
title: Patient Flag API
slug: /apps/backend/api/patient-flag
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/patient-flags

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientFlagController`

### GET /pms/organisation/:organisationId/patient-flags

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PatientFlagController`

### GET /pms/organisation/:organisationId/patient-flags/:flagId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PatientFlagController`

### PATCH /pms/organisation/:organisationId/patient-flags/:flagId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientFlagController`

### POST /pms/organisation/:organisationId/patient-flags/:flagId/resolve

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientFlagController`
