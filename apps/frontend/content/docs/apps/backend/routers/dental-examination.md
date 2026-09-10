---
id: backend-api-dental-examination
title: Dental Examination API
slug: /apps/backend/api/dental-examination
---

Records a patient's dental examination in the PIMS (Practice Information Management System) — an overall periodontal grade, per-tooth findings (condition, mobility, calculus, periodontal depth), calculus/plaque/gingival scores, and any procedures performed.

**Endpoints**

### GET /pms/organisation/:organisationId/dental-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`
- Controller: `DentalExaminationController.list`

### POST /pms/organisation/:organisationId/dental-examinations

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId`, `examinedAt`, `overallGrade`, `findings`, `calculusScore`, `plaqueScore`, `gingivalScore`, `procedures`, `notes`
- Controller: `DentalExaminationController.create`
- Response: `201`: JSON — the created examination

### GET /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Controller: `DentalExaminationController.get`

### PUT /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Body fields: `overallGrade`, `findings`, `calculusScore`, `plaqueScore`, `gingivalScore`, `procedures`, `notes`
- Controller: `DentalExaminationController.update`

### DELETE /pms/organisation/:organisationId/dental-examinations/:examId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `examId`
- Controller: `DentalExaminationController.delete`
- Response: `204`: no content
