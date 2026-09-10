---
id: backend-api-preventive-care-plan
title: Preventive Care Plan API
slug: /apps/backend/api/preventive-care-plan
---

Manages a patient's preventive-care plan in the PIMS (Practice Information Management System, the clinic-facing web app) — a named plan (for example "Annual Wellness") made up of recurring care items such as vaccinations or parasite prevention, each with its own frequency (`WEEKLY`, `MONTHLY`, `QUARTERLY`, `BIANNUAL`, `ANNUAL`, or `CUSTOM`) and next-due date. The plan itself tracks status through `ACTIVE`, `PAUSED`, `COMPLETED`, or `CANCELLED`, and individual items are marked done through a dedicated complete endpoint. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/preventive-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `status`
- Controller: `PreventiveCarePlanController.list`

### POST /pms/organisation/:organisationId/preventive-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `name`, `description`, `items` (optional array of `{ careType, frequency, intervalDays, nextDueAt, notes }`) (`patientId` and `name` are required, the rest optional)
- Controller: `PreventiveCarePlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/preventive-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `PreventiveCarePlanController.get`

### PUT /pms/organisation/:organisationId/preventive-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `UpdatePlanBodySchema`
- Body fields: `name`, `description`, `status` (all optional)
- Controller: `PreventiveCarePlanController.update`

### POST /pms/organisation/:organisationId/preventive-care-plans/:planId/items

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `ItemSchema`
- Body fields: `careType`, `frequency`, `intervalDays`, `nextDueAt`, `notes` (`careType` and `frequency` are required, the rest optional)
- Controller: `PreventiveCarePlanController.addItem`
- Response: `201`: JSON

### POST /pms/organisation/:organisationId/preventive-care-plans/:planId/items/:itemId/complete

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`, `itemId`
- Body: `CompleteItemBodySchema`
- Body fields: `completedAt`, `nextDueAt`, `notes` (all optional)
- Controller: `PreventiveCarePlanController.completeItem`
