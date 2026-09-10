---
id: backend-api-physiotherapy-plan
title: Physiotherapy Plan API
slug: /apps/backend/api/physiotherapy-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/physiotherapy-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PhysiotherapyPlanController`

### POST /pms/organisation/:organisationId/physiotherapy-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PhysiotherapyPlanController`

### GET /pms/organisation/:organisationId/physiotherapy-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PhysiotherapyPlanController`

### PUT /pms/organisation/:organisationId/physiotherapy-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PhysiotherapyPlanController`
