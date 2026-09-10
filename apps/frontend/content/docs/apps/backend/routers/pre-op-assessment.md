---
id: backend-api-pre-op-assessment
title: Pre-Op Assessment API
slug: /apps/backend/api/pre-op-assessment
---

Records a patient's pre-anaesthetic/pre-surgical assessment in the PIMS (Practice Information Management System, the clinic-facing web app) — ASA (American Society of Anesthesiologists) physical-status classification, fasting start time, whether labs and ECG were reviewed, owner consent, the assigned anesthetist/surgeon, and clinical notes. All routes require organisation RBAC (role-based access control) permissions. Unlike the other clinical CRUD routers in this batch, this controller validates requests by hand rather than through the shared clinical-handler helper, so a validation failure returns `{ error: <zod issues> }` instead of `{ message }`.

**Endpoints**

### POST /pms/organisation/:organisationId/pre-op-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreatePreOpSchema`
- Body fields: `patientId`, `encounterId`, `asaClass` (one of `ASA_I`, `ASA_II`, `ASA_III`, `ASA_IV`, `ASA_V`, `ASA_E`), `fastingStartedAt`, `labsReviewed`, `ecgReviewed`, `ownerConsentSigned`, `anesthetistId`, `surgeonId`, `plannedProcedure`, `anesthesiaType`, `knownAllergies`, `currentMedications`, `airwayNotes`, `cardiovascularNotes`, `notes`, `assessedBy`, `assessedAt` (`patientId` and `encounterId` are required, the rest optional)
- Controller: `PreOpAssessmentController.create`
- Response: `201`: JSON, `400`: keys `error`

### GET /pms/organisation/:organisationId/pre-op-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `asaClass`
- Controller: `PreOpAssessmentController.list`
- Response: `400`: keys `error`

### GET /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `PreOpAssessmentController.get`

### PATCH /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body: `UpdatePreOpSchema`
- Body fields: `asaClass`, `fastingStartedAt`, `labsReviewed`, `ecgReviewed`, `ownerConsentSigned`, `anesthetistId`, `surgeonId`, `plannedProcedure`, `anesthesiaType`, `knownAllergies`, `currentMedications`, `airwayNotes`, `cardiovascularNotes`, `notes`, `assessedBy`, `assessedAt` (all optional; `patientId` and `encounterId` cannot be changed)
- Controller: `PreOpAssessmentController.update`
- Response: `400`: keys `error`

### DELETE /pms/organisation/:organisationId/pre-op-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `PreOpAssessmentController.delete`
- Response: `204`: JSON
