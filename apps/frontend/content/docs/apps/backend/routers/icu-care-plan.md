---
id: backend-api-icu-care-plan
title: Icu Care Plan API
slug: /apps/backend/api/icu-care-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/icu-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `IcuCarePlanController`

### POST /pms/organisation/:organisationId/icu-care-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `IcuCarePlanController`

### GET /pms/organisation/:organisationId/icu-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `IcuCarePlanController`

### PUT /pms/organisation/:organisationId/icu-care-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `IcuCarePlanController`

### POST /pms/organisation/:organisationId/icu-care-plans/:planId/discharge

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `IcuCarePlanController`
