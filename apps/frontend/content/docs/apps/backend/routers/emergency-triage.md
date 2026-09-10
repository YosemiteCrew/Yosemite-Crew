---
id: backend-api-emergency-triage
title: Emergency Triage API
slug: /apps/backend/api/emergency-triage
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/emergency-triage

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `EmergencyTriageController`

### POST /pms/organisation/:organisationId/emergency-triage

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `EmergencyTriageController`

### GET /pms/organisation/:organisationId/emergency-triage/:triageId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `EmergencyTriageController`

### POST /pms/organisation/:organisationId/emergency-triage/:triageId/escalate

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `EmergencyTriageController`
