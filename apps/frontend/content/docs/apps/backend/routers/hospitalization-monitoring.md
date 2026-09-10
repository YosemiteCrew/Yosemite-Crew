---
id: backend-api-hospitalization-monitoring
title: Hospitalization Monitoring API
slug: /apps/backend/api/hospitalization-monitoring
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/hospitalization-monitoring

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `HospitalizationMonitoringController`

### POST /pms/organisation/:organisationId/hospitalization-monitoring

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `HospitalizationMonitoringController`

### GET /pms/organisation/:organisationId/hospitalization-monitoring/:obsId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `HospitalizationMonitoringController`

### DELETE /pms/organisation/:organisationId/hospitalization-monitoring/:obsId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `HospitalizationMonitoringController`
