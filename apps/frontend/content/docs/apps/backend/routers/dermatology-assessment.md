---
id: backend-api-dermatology-assessment
title: Dermatology Assessment API
slug: /apps/backend/api/dermatology-assessment
---

Records a patient's dermatology assessment in the PIMS (Practice Information Management System) — pruritus score, affected regions and lesion mapping, coat quality, environmental allergens and food-trial status, a CADESI-04 (Canine Atopic Dermatitis Extent and Severity Index) score, and differential diagnoses.

**Endpoints**

### GET /pms/organisation/:organisationId/dermatology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`
- Controller: `DermatologyAssessmentController.list`

### POST /pms/organisation/:organisationId/dermatology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId`, `assessedAt`, `pruritusScore`, `affectedRegions`, `primaryLesions`, `secondaryLesions`, `coatQuality`, `lesionMap`, `environmentalAllergens`, `foodTrialStatus`, `cades04Score`, `diagnoses`, `notes`
- Controller: `DermatologyAssessmentController.create`
- Response: `201`: JSON — the created assessment

### GET /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `DermatologyAssessmentController.get`

### PUT /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body fields: `pruritusScore`, `affectedRegions`, `primaryLesions`, `secondaryLesions`, `coatQuality`, `lesionMap`, `environmentalAllergens`, `foodTrialStatus`, `cades04Score`, `diagnoses`, `notes`
- Controller: `DermatologyAssessmentController.update`

### DELETE /pms/organisation/:organisationId/dermatology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `DermatologyAssessmentController.delete`
- Response: `204`: no content
