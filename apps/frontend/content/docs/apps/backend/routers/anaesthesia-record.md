---
id: backend-api-anaesthesia-record
title: Anaesthesia Record API
slug: /apps/backend/api/anaesthesia-record
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/anaesthesia

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `AnaesthesiaRecordController`

### POST /pms/organisation/:organisationId/anaesthesia

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `AnaesthesiaRecordController`

### GET /pms/organisation/:organisationId/anaesthesia/:recordId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `AnaesthesiaRecordController`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/start

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `AnaesthesiaRecordController`

### PATCH /pms/organisation/:organisationId/anaesthesia/:recordId/intraop-notes

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `AnaesthesiaRecordController`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/complete

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `AnaesthesiaRecordController`

### POST /pms/organisation/:organisationId/anaesthesia/:recordId/abort

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `AnaesthesiaRecordController`
