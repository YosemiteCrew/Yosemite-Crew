---
id: backend-api-deceased-record
title: Deceased Record API
slug: /apps/backend/api/deceased-record
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/deceased-records

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `deceasedRecordController`

### GET /pms/organisation/:organisationId/deceased-records

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `deceasedRecordController`

### GET /pms/organisation/:organisationId/deceased-records/:recordId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `deceasedRecordController`

### PATCH /pms/organisation/:organisationId/deceased-records/:recordId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `deceasedRecordController`

### GET /pms/organisation/:organisationId/patients/:patientId/deceased-record

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `deceasedRecordController`
