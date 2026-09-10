---
id: backend-api-nutrition-assessment
title: Nutrition Assessment API
slug: /apps/backend/api/nutrition-assessment
---

Manages nutrition assessment records — appetite score, body and muscle condition scores, current/ideal weight, resting energy requirement, feeding route and plan, supplementation, hydration status, and related diagnoses — for a patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation.

**Endpoints**

### GET /pms/organisation/:organisationId/nutrition-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `appetiteScore?`
- Controller: `NutritionAssessmentController.list`

### POST /pms/organisation/:organisationId/nutrition-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `assessedAt`, `appetiteScore?`, `bodyConditionScore?`, `muscleConditionScore?`, `currentWeightKg?`, `idealWeightKg?`, `restingEnergyRequirement?`, `feedingRoute?`, `currentDiet?`, `feedingPlan?`, `supplementation?`, `hydrationStatus?`, `diagnoses?`, `notes?`
- Controller: `NutritionAssessmentController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `NutritionAssessmentController.get`

### PUT /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body fields: `appetiteScore?`, `bodyConditionScore?`, `muscleConditionScore?`, `currentWeightKg?`, `idealWeightKg?`, `restingEnergyRequirement?`, `feedingRoute?`, `currentDiet?`, `feedingPlan?`, `supplementation?`, `hydrationStatus?`, `diagnoses?`, `notes?` (`patientId` and `assessedAt` are not updatable)
- Controller: `NutritionAssessmentController.update`

### DELETE /pms/organisation/:organisationId/nutrition-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `NutritionAssessmentController.delete`
- Response: `204`: no content
