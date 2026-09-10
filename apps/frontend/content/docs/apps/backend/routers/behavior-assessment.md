---
id: backend-api-behavior-assessment
title: Behavior Assessment API
slug: /apps/backend/api/behavior-assessment
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/behavior-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BehaviorAssessmentController`

### POST /pms/organisation/:organisationId/behavior-assessments

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BehaviorAssessmentController`

### GET /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `BehaviorAssessmentController`

### PUT /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BehaviorAssessmentController`

### DELETE /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `BehaviorAssessmentController`
