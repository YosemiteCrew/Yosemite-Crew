---
id: backend-api-clinical-alert-log
title: Clinical Alert Log API
slug: /apps/backend/api/clinical-alert-log
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/clinical-alerts

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `ClinicalAlertLogController`

### POST /pms/organisation/:organisationId/clinical-alerts

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicalAlertLogController`

### GET /pms/organisation/:organisationId/clinical-alerts/:alertId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `ClinicalAlertLogController`

### POST /pms/organisation/:organisationId/clinical-alerts/:alertId/acknowledge

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicalAlertLogController`

### POST /pms/organisation/:organisationId/clinical-alerts/:alertId/dismiss

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `ClinicalAlertLogController`
