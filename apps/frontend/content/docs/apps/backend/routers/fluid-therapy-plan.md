---
id: backend-api-fluid-therapy-plan
title: Fluid Therapy Plan API
slug: /apps/backend/api/fluid-therapy-plan
---

Manages inpatient fluid therapy plans: fluid type and rate, volume and duration, and status over the course of an admission. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation and not-found errors from the service layer come back as `{ message }`.

**Endpoints**

### GET /pms/organisation/:organisationId/fluid-therapy-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `admissionId`, `status` (`ACTIVE`, `PAUSED`, `COMPLETED`, `DISCONTINUED`)
- Controller: `FluidTherapyPlanController.list`

### POST /pms/organisation/:organisationId/fluid-therapy-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `admissionId`, `fluidType` (`SALINE_09`, `LACTATED_RINGERS`, `DEXTROSE_5`, `HARTMANNS`, `PLASMALYTE`, `COLLOID`, `BLOOD_PRODUCT`, `CUSTOM`), `customFluidName`, `additives`, `rateMlPerHour`, `totalVolumeMl`, `durationHours`, `startedAt`, `endedAt`, `indication`, `notes`
- Controller: `FluidTherapyPlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/fluid-therapy-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `FluidTherapyPlanController.get`

### PUT /pms/organisation/:organisationId/fluid-therapy-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `UpdateBodySchema`
- Body fields: `fluidType`, `customFluidName`, `additives`, `rateMlPerHour`, `totalVolumeMl`, `durationHours`, `endedAt`, `status`, `indication`, `notes`
- Controller: `FluidTherapyPlanController.update`
