---
id: backend-api-diagnostic-image
title: Diagnostic Image API
slug: /apps/backend/api/diagnostic-image
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/diagnostic-images

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DiagnosticImageController`

### POST /pms/organisation/:organisationId/diagnostic-images

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DiagnosticImageController`

### GET /pms/organisation/:organisationId/diagnostic-images/:imageId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DiagnosticImageController`

### PUT /pms/organisation/:organisationId/diagnostic-images/:imageId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DiagnosticImageController`

### POST /pms/organisation/:organisationId/diagnostic-images/:imageId/review

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DiagnosticImageController`
