---
id: backend-api-nutrition-plan
title: Nutrition Plan API
slug: /apps/backend/api/nutrition-plan
---

Manages prescribed nutrition/diet plans — diet name, calorie and macronutrient (protein/fat/fibre) targets, feeding frequency and portion size, water intake, restrictions, indication, and review date — for a patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation. Unlike the other clinical assessment routers in this batch, there is no delete route — a plan is retired via its `status` field instead.

**Endpoints**

### GET /pms/organisation/:organisationId/nutrition-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `status?`
- Controller: `NutritionPlanController.list`

### POST /pms/organisation/:organisationId/nutrition-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `dietName`, `calories?`, `calorieUnit?`, `protein?`, `fat?`, `fibre?`, `feedingFrequency?`, `portionSize?`, `waterIntake?`, `restrictions?`, `indication?`, `reviewDate?`, `notes?`
- Controller: `NutritionPlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/nutrition-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `NutritionPlanController.get`

### PUT /pms/organisation/:organisationId/nutrition-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body fields: `dietName?`, `calories?`, `calorieUnit?`, `protein?`, `fat?`, `fibre?`, `feedingFrequency?`, `portionSize?`, `waterIntake?`, `restrictions?`, `indication?`, `reviewDate?`, `notes?`, `status?`
- Controller: `NutritionPlanController.update`
