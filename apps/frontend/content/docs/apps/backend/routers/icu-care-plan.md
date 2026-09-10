---
id: backend-api-icu-care-plan
title: ICU Care Plan API
slug: /apps/backend/api/icu-care-plan
---

Manages ICU (intensive care unit) stays for a hospitalised patient: admission, the ongoing care plan (ventilator/oxygen support, lines and drains, nursing goals and frequency, alert thresholds), and discharge/transfer/death. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/icu-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `status` (`ACTIVE`|`TRANSFERRED`|`DISCHARGED`|`DECEASED`)
- Controller: `IcuCarePlanController.list`

### POST /pms/organisation/:organisationId/icu-care-plans

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `admittedAt`, `onVentilator`, `onOxygenSupport`, `hasUrinaryCatheter`, `hasCentralLine`, `hasDrain`, `devices`, `dailyGoals`, `nursingFrequency`, `alertThresholds`, `primaryVet` (defaults to the caller if omitted), `nursePrimary`, `anticipatedDischarge`, `notes`
- Controller: `IcuCarePlanController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/icu-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Controller: `IcuCarePlanController.get`

### PUT /pms/organisation/:organisationId/icu-care-plans/:planId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `CareFieldsSchema`
- Body fields: `onVentilator`, `onOxygenSupport`, `hasUrinaryCatheter`, `hasCentralLine`, `hasDrain`, `devices`, `dailyGoals`, `nursingFrequency`, `alertThresholds`, `primaryVet`, `nursePrimary`, `anticipatedDischarge`, `notes` (all optional)
- Controller: `IcuCarePlanController.update`

### POST /pms/organisation/:organisationId/icu-care-plans/:planId/discharge

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `planId`
- Body: `DischargeBodySchema`
- Body fields: `status` (`TRANSFERRED`|`DISCHARGED`|`DECEASED`), `dischargeSummary`
- Controller: `IcuCarePlanController.discharge`
