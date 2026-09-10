---
id: backend-api-clinical-progress-note
title: Clinical Progress Note API
slug: /apps/backend/api/clinical-progress-note
---

Manages free-form clinical progress notes for a patient — shift note, progress note, nurse note, specialist note, discharge summary, or other — with optional SOAP-style subjective/objective/assessment/plan fields, free text, and a sign-off step. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are gated by organisation RBAC (role-based access control).

**Endpoints**

### GET /pms/organisation/:organisationId/clinical-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `noteType`
- Controller: `ClinicalProgressNoteController.list`

### POST /pms/organisation/:organisationId/clinical-notes

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `CreateBodySchema`
- Body fields: `patientId`, `encounterId`, `noteType`, `subjectiveFindings`, `objectiveFindings`, `assessment`, `plan`, `freeText`, `authorName`
- Controller: `ClinicalProgressNoteController.create`
- Response: `201`: the created note record

### GET /pms/organisation/:organisationId/clinical-notes/:noteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Controller: `ClinicalProgressNoteController.get`

### PUT /pms/organisation/:organisationId/clinical-notes/:noteId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Body: `UpdateBodySchema`
- Body fields: `subjectiveFindings`, `objectiveFindings`, `assessment`, `plan`, `freeText`
- Controller: `ClinicalProgressNoteController.update`

### POST /pms/organisation/:organisationId/clinical-notes/:noteId/sign

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `noteId`
- Controller: `ClinicalProgressNoteController.sign`
