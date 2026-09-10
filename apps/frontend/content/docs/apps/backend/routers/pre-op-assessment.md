---
id: backend-api-pre-op-assessment
title: Pre Op Assessment API
slug: /apps/backend/api/pre-op-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### POST /pms/organisation/:organisationId/pre-op-assessments

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PreOpAssessmentController`

### GET /pms/organisation/:organisationId/pre-op-assessments

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PreOpAssessmentController`

### GET /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `companions:view:any`
- Controller: `PreOpAssessmentController`

### PATCH /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PreOpAssessmentController`

### DELETE /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `companions:edit:any`
- Controller: `PreOpAssessmentController`
