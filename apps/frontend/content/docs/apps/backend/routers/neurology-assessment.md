---
id: backend-api-neurology-assessment
title: Neurology Assessment API
slug: /apps/backend/api/neurology-assessment
---

Manages neurology assessment records — consciousness level, gait score, cranial nerve findings, spinal reflex grades, deep pain and proprioception status, seizure history, and related diagnoses — for a patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation.

**Endpoints**

### GET /pms/organisation/:organisationId/neurology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `gaitScore?`
- Controller: `NeurologyAssessmentController.list`

### POST /pms/organisation/:organisationId/neurology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `assessedAt`, `consciousnessLevel?`, `gaitScore?`, `cranialNerveFindings?`, `spinalReflexGrades?`, `deepPainPresent?`, `proprioceptionIntact?`, `seizureHistory?`, `seizureFrequency?`, `mriRecommended?`, `diagnoses?`, `notes?`
- Controller: `NeurologyAssessmentController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `NeurologyAssessmentController.get`

### PUT /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body fields: `consciousnessLevel?`, `gaitScore?`, `cranialNerveFindings?`, `spinalReflexGrades?`, `deepPainPresent?`, `proprioceptionIntact?`, `seizureHistory?`, `seizureFrequency?`, `mriRecommended?`, `diagnoses?`, `notes?` (`patientId` and `assessedAt` are not updatable)
- Controller: `NeurologyAssessmentController.update`

### DELETE /pms/organisation/:organisationId/neurology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `NeurologyAssessmentController.delete`
- Response: `204`: no content
