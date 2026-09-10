---
id: backend-api-body-condition
title: Body Condition API
slug: /apps/backend/api/body-condition
---

Records and trends a patient's body condition score (on either the 5-point or 9-point BCS scale), weight, and body fat percentage, for the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. Route params and payloads are validated with Zod; an invalid path parameter returns `400` with a `message`, and a domain-specific failure returns the matching status with a `message` from the service.

**Endpoints**

### GET /pms/organisation/:organisationId/body-condition

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `bcsScale`, `from`, `to`
- Controller: `BodyConditionController.list`

### POST /pms/organisation/:organisationId/body-condition

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordBodySchema`
- Body fields: `patientId`, `encounterId`, `bcsScale`, `bcsScore`, `muscleConditionScore`, `weightKg`, `bodyFatPercentage`, `recordedAt`, `notes`
- Controller: `BodyConditionController.record`
- Response: `201`: JSON (recorded body condition entry)

### GET /pms/organisation/:organisationId/body-condition/trend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `limit`
- Controller: `BodyConditionController.trend`

### GET /pms/organisation/:organisationId/body-condition/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `BodyConditionController.get`

### DELETE /pms/organisation/:organisationId/body-condition/:recordId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `recordId`
- Controller: `BodyConditionController.delete`
- Response: `204`: no content
