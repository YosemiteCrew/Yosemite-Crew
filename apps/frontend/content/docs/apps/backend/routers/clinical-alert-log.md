---
id: backend-api-clinical-alert-log
title: Clinical Alert Log API
slug: /apps/backend/api/clinical-alert-log
---

Logs clinical alerts triggered for a patient — drug interaction, critical lab value, overdue vaccination, allergy contraindication, dose check, abnormal vitals, specialist review due, weight threshold, or other — with a severity (info, warning, critical) and an acknowledge/dismiss workflow. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### GET /pms/organisation/:organisationId/clinical-alerts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `severity`, `alertType`, `dismissed`
- Controller: `ClinicalAlertLogController.list`
- Response: `400`: `{ error }` on invalid query

### POST /pms/organisation/:organisationId/clinical-alerts

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `TriggerSchema`
- Body fields: `patientId`, `encounterId`, `alertType`, `severity`, `title`, `body`, `triggeredBy`
- Controller: `ClinicalAlertLogController.trigger`
- Response: `201`: the created alert, `400`: `{ error }` on invalid body

### GET /pms/organisation/:organisationId/clinical-alerts/:alertId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `alertId`
- Controller: `ClinicalAlertLogController.get`

### POST /pms/organisation/:organisationId/clinical-alerts/:alertId/acknowledge

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `alertId`
- Body: `AcknowledgeSchema`
- Body fields: `acknowledgedBy`, `note`
- Controller: `ClinicalAlertLogController.acknowledge`
- Response: `400`: `{ error }` on invalid body

### POST /pms/organisation/:organisationId/clinical-alerts/:alertId/dismiss

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `alertId`
- Controller: `ClinicalAlertLogController.dismiss`
