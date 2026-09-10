---
id: backend-api-neurology-assessment
title: Neurology Assessment API
slug: /apps/backend/api/neurology-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/neurology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NeurologyAssessmentController`

### POST /pms/organisation/:organisationId/neurology-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NeurologyAssessmentController`

### GET /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `NeurologyAssessmentController`

### PUT /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NeurologyAssessmentController`

### DELETE /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `NeurologyAssessmentController`
