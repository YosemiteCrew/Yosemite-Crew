---
id: backend-api-controlled-substance-log
title: Controlled Substance Log API
slug: /apps/backend/api/controlled-substance-log
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/controlled-substance-logs

- Auth: `requireWebAuth`
- Permission: `controlled-drug-register:read`
- Controller: `ControlledSubstanceLogController`

### POST /pms/organisation/:organisationId/controlled-substance-logs

- Auth: `requireWebAuth`
- Permission: `controlled-drug-register:record`
- Controller: `ControlledSubstanceLogController`

### GET /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- Permission: `controlled-drug-register:read`
- Controller: `ControlledSubstanceLogController`

### PUT /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- Permission: `controlled-drug-register:correct`
- Controller: `ControlledSubstanceLogController`

### DELETE /pms/organisation/:organisationId/controlled-substance-logs/:logId

- Auth: `requireWebAuth`
- Permission: `controlled-drug-register:correct`
- Controller: `ControlledSubstanceLogController`
