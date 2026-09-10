---
id: backend-api-oncology-assessment
title: Oncology Assessment API
slug: /apps/backend/api/oncology-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/oncology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `OncologyAssessmentController`

### POST /pms/organisation/:organisationId/oncology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OncologyAssessmentController`

### GET /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `OncologyAssessmentController`

### PUT /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OncologyAssessmentController`

### DELETE /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `OncologyAssessmentController`
