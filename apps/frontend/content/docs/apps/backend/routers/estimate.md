---
id: backend-api-estimate
title: Estimate API
slug: /apps/backend/api/estimate
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/estimates

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### GET /pms/organisation/:organisationId/estimates

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `estimateController`

### GET /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- Permission: `billing:view:any`
- Controller: `estimateController`

### PATCH /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### DELETE /pms/organisation/:organisationId/estimates/:estimateId

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### POST /pms/organisation/:organisationId/estimates/:estimateId/send

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### POST /pms/organisation/:organisationId/estimates/:estimateId/approve

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### POST /pms/organisation/:organisationId/estimates/:estimateId/convert

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`

### POST /pms/organisation/:organisationId/estimates/:estimateId/decline

- Auth: `requireWebAuth`
- Permission: `billing:edit:any`
- Controller: `estimateController`
