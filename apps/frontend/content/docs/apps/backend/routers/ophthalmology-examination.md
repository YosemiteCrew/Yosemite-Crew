---
id: backend-api-ophthalmology-examination
title: Ophthalmology Examination API
slug: /apps/backend/api/ophthalmology-examination
---

Manages ophthalmology examination records — vision status, menace response, pupillary light reflex (direct and consensual), Schirmer tear test (STT) and intraocular pressure (IOP) readings, fluorescein staining, and structured per-eye findings (discharge, corneal/lens/vitreous clarity, retina, conjunctiva) — for a patient, recorded separately for the left and right eye. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation.

**Endpoints**

### GET /pms/organisation/:organisationId/ophthalmology-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`
- Controller: `OphthalmologyExaminationController.list`

### POST /pms/organisation/:organisationId/ophthalmology-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `examinedAt`, `visionLeft?`, `visionRight?`, `menaceLeft?`, `menaceRight?`, `plrDirectLeft?`, `plrDirectRight?`, `plrConsensualLeft?`, `plrConsensualRight?`, `sttLeft?`, `sttRight?`, `iopLeft?`, `iopRight?`, `fluoresceinLeft?`, `fluoresceinRight?`, `findingsLeft?` (`{discharge?, cornealClarity?, lensClarity?, vitreousClarity?, retina?, conjunctiva?, notes?}`), `findingsRight?` (same shape as `findingsLeft`), `diagnoses?`, `notes?`
- Controller: `OphthalmologyExaminationController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Controller: `OphthalmologyExaminationController.get`

### PUT /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Body fields: `visionLeft?`, `visionRight?`, `menaceLeft?`, `menaceRight?`, `plrDirectLeft?`, `plrDirectRight?`, `plrConsensualLeft?`, `plrConsensualRight?`, `sttLeft?`, `sttRight?`, `iopLeft?`, `iopRight?`, `fluoresceinLeft?`, `fluoresceinRight?`, `findingsLeft?`, `findingsRight?`, `diagnoses?`, `notes?` (`patientId` and `examinedAt` are not updatable)
- Controller: `OphthalmologyExaminationController.update`

### DELETE /pms/organisation/:organisationId/ophthalmology-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Controller: `OphthalmologyExaminationController.delete`
- Response: `204`: no content
