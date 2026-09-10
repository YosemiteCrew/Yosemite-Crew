---
id: backend-api-pain-assessment
title: Pain Assessment API
slug: /apps/backend/api/pain-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/pain-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PainAssessmentController`

### POST /pms/organisation/:organisationId/pain-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PainAssessmentController`

### GET /pms/organisation/:organisationId/pain-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PainAssessmentController`

### DELETE /pms/organisation/:organisationId/pain-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PainAssessmentController`
