---
id: backend-api-aftercare-plan
title: Aftercare Plan API
slug: /apps/backend/api/aftercare-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/aftercare-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `AftercarePlanController`

### POST /pms/organisation/:organisationId/aftercare-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `AftercarePlanController`

### GET /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `AftercarePlanController`

### PUT /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `AftercarePlanController`

### DELETE /pms/organisation/:organisationId/aftercare-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `AftercarePlanController`
