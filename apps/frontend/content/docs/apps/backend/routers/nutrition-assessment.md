---
id: backend-api-nutrition-assessment
title: Nutrition Assessment API
slug: /apps/backend/api/nutrition-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/nutrition-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NutritionAssessmentController`

### POST /pms/organisation/:organisationId/nutrition-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NutritionAssessmentController`

### GET /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NutritionAssessmentController`

### PUT /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NutritionAssessmentController`

### DELETE /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NutritionAssessmentController`
