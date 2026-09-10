---
id: backend-api-dental-examination
title: Dental Examination API
slug: /apps/backend/api/dental-examination
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/dental-examinations

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DentalExaminationController`

### POST /pms/organisation/:organisationId/dental-examinations

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DentalExaminationController`

### GET /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DentalExaminationController`

### PUT /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DentalExaminationController`

### DELETE /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DentalExaminationController`
