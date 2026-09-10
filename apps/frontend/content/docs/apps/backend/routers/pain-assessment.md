---
id: backend-api-pain-assessment
title: Pain Assessment API
slug: /apps/backend/api/pain-assessment
---

Records structured pain-assessment scores for a patient during a clinical encounter: the pain scale used, the numeric score, behavioural signs, and any pain-relief intervention given. All routes are under the PIMS (Practice Information Management System, the clinic-facing web app) `/pms` namespace and require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/pain-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `from?`, `to?`
- Controller: `PainAssessmentController.list`

### POST /pms/organisation/:organisationId/pain-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `painScale`, `painScore`, `rawScore?`, `behaviouralSigns?`, `vocalisation?`, `posture?`, `assessedAt`, `interventionType?`, `interventionDetail?`, `reassessAt?`, `notes?`
- Controller: `PainAssessmentController.record`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/pain-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `PainAssessmentController.get`

### DELETE /pms/organisation/:organisationId/pain-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `PainAssessmentController.delete`
- Response: `204`: no content
