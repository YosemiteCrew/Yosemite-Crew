---
id: backend-api-qol-assessment
title: Qol Assessment API
slug: /apps/backend/api/qol-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/qol-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `QolAssessmentController`

### POST /pms/organisation/:organisationId/qol-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `QolAssessmentController`

### GET /pms/organisation/:organisationId/qol-assessments/trend

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `QolAssessmentController`

### GET /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `QolAssessmentController`

### PUT /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `QolAssessmentController`

### DELETE /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `QolAssessmentController`
