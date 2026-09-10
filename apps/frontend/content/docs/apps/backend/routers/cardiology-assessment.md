---
id: backend-api-cardiology-assessment
title: Cardiology Assessment API
slug: /apps/backend/api/cardiology-assessment
---

Manages cardiology assessment records for a patient — heart rate/rhythm, murmur grade/location/character, pulse quality, jugular pulse, vertebral heart score (VHS), LA:Ao ratio, fractional shortening, ejection fraction, and ACVIM heart-failure class (the veterinary cardiology staging system, grades A through D). All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### GET /pms/organisation/:organisationId/cardiology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `acvimClass`
- Controller: `CardiologyAssessmentController.list`

### POST /pms/organisation/:organisationId/cardiology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `assessedAt`, `heartRate`, `heartRhythm`, `murmurGrade`, `murmurLocation`, `murmurCharacter`, `pulseQuality`, `jugularPulse`, `vertebralHeartScore`, `laAoRatio`, `fractionalShortening`, `ejectionFraction`, `acvimClass`, `findings`, `diagnoses`, `notes`
- Controller: `CardiologyAssessmentController.create`
- Response: `201`: the created assessment record

### GET /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `CardiologyAssessmentController.get`

### PUT /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body: `UpdateBodySchema`
- Body fields: `encounterId`, `heartRate`, `heartRhythm`, `murmurGrade`, `murmurLocation`, `murmurCharacter`, `pulseQuality`, `jugularPulse`, `vertebralHeartScore`, `laAoRatio`, `fractionalShortening`, `ejectionFraction`, `acvimClass`, `findings`, `diagnoses`, `notes` (all optional; `patientId` and `assessedAt` cannot be changed)
- Controller: `CardiologyAssessmentController.update`

### DELETE /pms/organisation/:organisationId/cardiology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `CardiologyAssessmentController.delete`
- Response: `204`: no content
