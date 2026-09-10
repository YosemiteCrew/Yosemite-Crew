---
id: backend-api-cardiology-assessment
title: Cardiology Assessment API
slug: /apps/backend/api/cardiology-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/cardiology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CardiologyAssessmentController`

### POST /pms/organisation/:organisationId/cardiology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CardiologyAssessmentController`

### GET /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `CardiologyAssessmentController`

### PUT /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CardiologyAssessmentController`

### DELETE /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `CardiologyAssessmentController`
