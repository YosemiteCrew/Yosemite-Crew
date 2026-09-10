---
id: backend-api-surgical-procedure
title: Surgical Procedure API
slug: /apps/backend/api/surgical-procedure
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/surgical-procedures

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `SurgicalProcedureController`

### POST /pms/organisation/:organisationId/surgical-procedures

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `SurgicalProcedureController`

### GET /pms/organisation/:organisationId/surgical-procedures/:procedureId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `SurgicalProcedureController`

### PUT /pms/organisation/:organisationId/surgical-procedures/:procedureId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `SurgicalProcedureController`
