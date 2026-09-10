---
id: backend-api-qol-assessment
title: QOL Assessment API
slug: /apps/backend/api/qol-assessment
---

Records a patient's quality-of-life (QOL) assessment in the PIMS (Practice Information Management System, the clinic-facing web app) — a composite `hhhhhmmScore` (0-70) plus individual 1-10 sub-scores for pain, appetite, hygiene, happiness, and mobility, an overall 0-100 score, whether the assessment was owner- or clinician-completed, and whether euthanasia was discussed. A trend endpoint returns a patient's assessments over time for charting. All routes require organisation RBAC (role-based access control) permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/qol-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `ownerAssessed`
- Controller: `QolAssessmentController.list`

### POST /pms/organisation/:organisationId/qol-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `assessedAt`, `hhhhhmmScore` (0-70), `painScore`, `appetiteScore`, `hygieneScore`, `happinessScore`, `mobilityScore` (each 1-10), `moreDaysGood`, `overallScore` (0-100), `ownerAssessed`, `clinicianNotes`, `ownerNotes`, `euthanasiaDiscussed` (`patientId` and `assessedAt` are required, the rest optional)
- Controller: `QolAssessmentController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/qol-assessments/trend

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId` (required), `limit`
- Controller: `QolAssessmentController.trend`
- Response: `400`: keys `message` — when `patientId` is omitted

### GET /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `QolAssessmentController.get`

### PUT /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body: `UpdateBodySchema`
- Body fields: `encounterId`, `assessedAt`, `hhhhhmmScore`, `painScore`, `appetiteScore`, `hygieneScore`, `happinessScore`, `mobilityScore`, `moreDaysGood`, `overallScore`, `ownerAssessed`, `clinicianNotes`, `ownerNotes`, `euthanasiaDiscussed` (all optional; `patientId` cannot be changed)
- Controller: `QolAssessmentController.update`

### DELETE /pms/organisation/:organisationId/qol-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `QolAssessmentController.delete`
- Response: `204`: JSON
