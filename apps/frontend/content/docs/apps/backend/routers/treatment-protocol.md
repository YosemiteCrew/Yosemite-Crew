---
id: backend-api-treatment-protocol
title: Treatment Protocol API
slug: /apps/backend/api/treatment-protocol
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/treatment-protocols

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `TreatmentProtocolController`

### POST /pms/organisation/:organisationId/treatment-protocols

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`

### GET /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `TreatmentProtocolController`

### PUT /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`

### DELETE /pms/organisation/:organisationId/treatment-protocols/:protocolId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`

### POST /pms/organisation/:organisationId/treatment-protocols/:protocolId/steps

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`

### DELETE /pms/organisation/:organisationId/treatment-protocols/:protocolId/steps/:stepId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`

### POST /pms/organisation/:organisationId/treatment-protocols/:protocolId/apply

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TreatmentProtocolController`
