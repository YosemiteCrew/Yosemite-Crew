---
id: backend-api-dermatology-assessment
title: Dermatology Assessment API
slug: /apps/backend/api/dermatology-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/dermatology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DermatologyAssessmentController`

### POST /pms/organisation/:organisationId/dermatology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DermatologyAssessmentController`

### GET /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `DermatologyAssessmentController`

### PUT /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DermatologyAssessmentController`

### DELETE /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `DermatologyAssessmentController`
