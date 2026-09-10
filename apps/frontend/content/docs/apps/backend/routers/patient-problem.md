---
id: backend-api-patient-problem
title: Patient Problem API
slug: /apps/backend/api/patient-problem
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-problems

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientProblemController`

### POST /pms/organisation/:organisationId/patient-problems

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientProblemController`

### GET /pms/organisation/:organisationId/patient-problems/:problemId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientProblemController`

### PUT /pms/organisation/:organisationId/patient-problems/:problemId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientProblemController`

### POST /pms/organisation/:organisationId/patient-problems/:problemId/resolve

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientProblemController`
