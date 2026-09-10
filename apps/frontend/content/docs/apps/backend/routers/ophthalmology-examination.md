---
id: backend-api-ophthalmology-examination
title: Ophthalmology Examination API
slug: /apps/backend/api/ophthalmology-examination
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/ophthalmology-examinations

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `OphthalmologyExaminationController`

### POST /pms/organisation/:organisationId/ophthalmology-examinations

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OphthalmologyExaminationController`

### GET /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `OphthalmologyExaminationController`

### PUT /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OphthalmologyExaminationController`

### DELETE /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OphthalmologyExaminationController`
