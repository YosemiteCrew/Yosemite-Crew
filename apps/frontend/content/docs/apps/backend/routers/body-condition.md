---
id: backend-api-body-condition
title: Body Condition API
slug: /apps/backend/api/body-condition
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/body-condition

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BodyConditionController`

### POST /pms/organisation/:organisationId/body-condition

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BodyConditionController`

### GET /pms/organisation/:organisationId/body-condition/trend

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BodyConditionController`

### GET /pms/organisation/:organisationId/body-condition/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BodyConditionController`

### DELETE /pms/organisation/:organisationId/body-condition/:recordId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BodyConditionController`
