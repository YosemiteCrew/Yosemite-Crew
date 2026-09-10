---
id: backend-api-reproductive-record
title: Reproductive Record API
slug: /apps/backend/api/reproductive-record
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/reproductive-records

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ReproductiveRecordController`

### POST /pms/organisation/:organisationId/reproductive-records

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReproductiveRecordController`

### GET /pms/organisation/:organisationId/reproductive-records/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `ReproductiveRecordController`

### PUT /pms/organisation/:organisationId/reproductive-records/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `ReproductiveRecordController`
