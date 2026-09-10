---
id: backend-api-behavior-assessment
title: Behavior Assessment API
slug: /apps/backend/api/behavior-assessment
---

Manages behavior assessments for a patient — Fear Anxiety Stress (FAS) score, handling tolerance, aggression triggers and aversion behaviors, training history, and Fear Free notes — recorded by the PIMS (Practice Information Management System, the clinic-facing web app). Gated by RBAC (role-based access control) under the `appointments` permission pair. Route params and payloads are validated with Zod; an invalid path parameter returns `400` with a `message`, and a domain-specific failure returns the matching status with a `message` from the service.

**Endpoints**

### GET /pms/organisation/:organisationId/behavior-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `fasScore`
- Controller: `BehaviorAssessmentController.list`

### POST /pms/organisation/:organisationId/behavior-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `assessedAt`, `fasScore`, `nailTrimTolerance`, `handlingTolerance`, `aggressionTriggers`, `aversionBehaviors`, `trainingHistory`, `diagnoses`, `referralRecommended`, `fearFreeNotes`, `notes`
- Controller: `BehaviorAssessmentController.create`
- Response: `201`: JSON (created behavior assessment record)

### GET /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `BehaviorAssessmentController.get`

### PUT /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body: `UpdateBodySchema`
- Body fields: `encounterId`, `fasScore`, `nailTrimTolerance`, `handlingTolerance`, `aggressionTriggers`, `aversionBehaviors`, `trainingHistory`, `diagnoses`, `referralRecommended`, `fearFreeNotes`, `notes`
- Controller: `BehaviorAssessmentController.update`

### DELETE /pms/organisation/:organisationId/behavior-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `BehaviorAssessmentController.delete`
- Response: `204`: no content
