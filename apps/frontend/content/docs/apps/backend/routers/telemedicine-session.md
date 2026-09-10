---
id: backend-api-telemedicine-session
title: Telemedicine Session API
slug: /apps/backend/api/telemedicine-session
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/telemedicine

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `TelemedicineSessionController`

### POST /pms/organisation/:organisationId/telemedicine

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TelemedicineSessionController`

### GET /pms/organisation/:organisationId/telemedicine/:sessionId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `TelemedicineSessionController`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/start

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TelemedicineSessionController`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/complete

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TelemedicineSessionController`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/cancel

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TelemedicineSessionController`

### POST /pms/organisation/:organisationId/telemedicine/:sessionId/no-show

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `TelemedicineSessionController`
