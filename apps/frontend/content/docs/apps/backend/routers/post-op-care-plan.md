---
id: backend-api-post-op-care-plan
title: Post Op Care Plan API
slug: /apps/backend/api/post-op-care-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/post-op-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PostOpCarePlanController`

### POST /pms/organisation/:organisationId/post-op-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PostOpCarePlanController`

### GET /pms/organisation/:organisationId/post-op-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PostOpCarePlanController`

### PUT /pms/organisation/:organisationId/post-op-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PostOpCarePlanController`

### POST /pms/organisation/:organisationId/post-op-care-plans/:planId/review

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PostOpCarePlanController`
