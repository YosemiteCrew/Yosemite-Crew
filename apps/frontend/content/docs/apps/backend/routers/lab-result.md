---
id: backend-api-lab-result
title: Lab Result API
slug: /apps/backend/api/lab-result
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/:provider/results

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`

### GET /pms/organisation/:organisationId/:provider/results/search

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`

### GET /pms/organisation/:organisationId/:provider/results/pdf

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`

### GET /pms/organisation/:organisationId/:provider/results/:resultId

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`

### GET /req

- Auth: `public`
- Controller: `inline handler`

### GET /pms/organisation/:organisationId/:provider/results/:resultId/pdf

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`

### GET /pms/organisation/:organisationId/:provider/results/:resultId/notifications/pdf

- Auth: `requireWebAuth`
- Permission: `labs:view:any`
- Controller: `LabResultController`
