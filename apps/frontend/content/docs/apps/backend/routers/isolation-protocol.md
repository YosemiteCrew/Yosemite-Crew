---
id: backend-api-isolation-protocol
title: Isolation Protocol API
slug: /apps/backend/api/isolation-protocol
---

Manages infection-control isolation protocols for a hospitalised patient: starting one (reason, isolation level, unit, PPE required), listing/viewing them, updating the in-progress protocol, and ending it. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/isolation-protocols

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `StartSchema`
- Body fields: `patientId`, `reason` (`PARVOVIRUS`|`DISTEMPER`|`RINGWORM`|`MRSA`|`RESPIRATORY_INFECTION`|`GASTROINTESTINAL_INFECTION`|`TICK_BORNE_DISEASE`|`UNDIAGNOSED_CONTAGIOUS`|`POST_OP_PRECAUTION`|`OTHER`), `level` (`STANDARD`|`CONTACT`|`DROPLET`|`AIRBORNE`|`STRICT`), `unitId`, `startedAt`, `initiatedBy`, `ppe` (string array), `notes`
- Controller: `IsolationProtocolController.start`
- Response: `201`: JSON, `400`: keys `error`

### GET /pms/organisation/:organisationId/isolation-protocols

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `active`, `reason`
- Controller: `IsolationProtocolController.list`
- Response: `400`: keys `error`

### GET /pms/organisation/:organisationId/isolation-protocols/:protocolId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Controller: `IsolationProtocolController.get`

### PATCH /pms/organisation/:organisationId/isolation-protocols/:protocolId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Body: `UpdateSchema`
- Body fields: `level`, `ppe`, `notes`, `unitId` (all optional)
- Controller: `IsolationProtocolController.update`
- Response: `400`: keys `error`

### POST /pms/organisation/:organisationId/isolation-protocols/:protocolId/end

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `protocolId`
- Body: `EndSchema`
- Body fields: `endedAt`, `endedBy`, `notes`
- Controller: `IsolationProtocolController.end`
- Response: `400`: keys `error`
