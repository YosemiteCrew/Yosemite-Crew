---
id: backend-api-wound-assessment
title: Wound Assessment API
slug: /apps/backend/api/wound-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/wound-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `WoundAssessmentController`

### POST /pms/organisation/:organisationId/wound-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WoundAssessmentController`

### GET /pms/organisation/:organisationId/wound-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `WoundAssessmentController`

### DELETE /pms/organisation/:organisationId/wound-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `WoundAssessmentController`
