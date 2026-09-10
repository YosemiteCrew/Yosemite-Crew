---
id: backend-api-mar
title: Mar API
slug: /apps/backend/api/mar
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/mar-entries

- Auth: `requireWebAuth`
- Controller: `MARController`

### POST /pms/organisation/:organisationId/mar-entries

- Auth: `requireWebAuth`
- Controller: `MARController`

### GET /pms/organisation/:organisationId/mar-entries/:marEntryId

- Auth: `requireWebAuth`
- Controller: `MARController`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/administer

- Auth: `requireWebAuth`
- Controller: `MARController`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/hold

- Auth: `requireWebAuth`
- Controller: `MARController`

### POST /pms/organisation/:organisationId/mar-entries/:marEntryId/miss

- Auth: `requireWebAuth`
- Controller: `MARController`
