---
id: backend-api-poc-lab
title: Poc Lab API
slug: /apps/backend/api/poc-lab
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/poc-lab

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PocLabController`

### POST /pms/organisation/:organisationId/poc-lab

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PocLabController`

### GET /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PocLabController`

### PUT /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PocLabController`

### DELETE /pms/organisation/:organisationId/poc-lab/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PocLabController`
