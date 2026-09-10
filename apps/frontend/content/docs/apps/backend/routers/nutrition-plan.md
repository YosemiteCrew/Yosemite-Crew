---
id: backend-api-nutrition-plan
title: Nutrition Plan API
slug: /apps/backend/api/nutrition-plan
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/nutrition-plans

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NutritionPlanController`

### POST /pms/organisation/:organisationId/nutrition-plans

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NutritionPlanController`

### GET /pms/organisation/:organisationId/nutrition-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NutritionPlanController`

### PUT /pms/organisation/:organisationId/nutrition-plans/:planId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NutritionPlanController`
