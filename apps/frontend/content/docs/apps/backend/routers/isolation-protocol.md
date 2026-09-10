---
id: backend-api-isolation-protocol
title: Isolation Protocol API
slug: /apps/backend/api/isolation-protocol
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/isolation-protocols

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `IsolationProtocolController`

### GET /pms/organisation/:organisationId/isolation-protocols

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `IsolationProtocolController`

### GET /pms/organisation/:organisationId/isolation-protocols/:protocolId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `IsolationProtocolController`

### PATCH /pms/organisation/:organisationId/isolation-protocols/:protocolId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `IsolationProtocolController`

### POST /pms/organisation/:organisationId/isolation-protocols/:protocolId/end

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `IsolationProtocolController`
