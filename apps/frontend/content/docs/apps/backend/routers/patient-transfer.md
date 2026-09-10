---
id: backend-api-patient-transfer
title: Patient Transfer API
slug: /apps/backend/api/patient-transfer
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/patient-transfers

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientTransferController`

### GET /pms/organisation/:organisationId/patient-transfers

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PatientTransferController`

### GET /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PatientTransferController`

### PATCH /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientTransferController`

### DELETE /pms/organisation/:organisationId/patient-transfers/:transferId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PatientTransferController`
