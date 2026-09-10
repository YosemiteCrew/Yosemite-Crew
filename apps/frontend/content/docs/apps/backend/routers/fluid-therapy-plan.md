---
id: backend-api-fluid-therapy-plan
title: Fluid Therapy Plan API
slug: /apps/backend/api/fluid-therapy-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/fluid-therapy-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `FluidTherapyPlanController`

### POST /pms/organisation/:organisationId/fluid-therapy-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `FluidTherapyPlanController`

### GET /pms/organisation/:organisationId/fluid-therapy-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `FluidTherapyPlanController`

### PUT /pms/organisation/:organisationId/fluid-therapy-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `FluidTherapyPlanController`
