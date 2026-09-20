---
id: backend-api-pathology-submission
title: Pathology Submission API
slug: /apps/backend/api/pathology-submission
---

Manages pathology submissions sent to an external lab for a patient: the sample and clinical context at submission, the results and diagnosis once they come back, and a reviewing clinician's notes. All routes are under the PIMS (Practice Information Management System, the clinic-facing web app) `/pms` namespace and require organisation RBAC (role-based access control) permissions on `labs`.

**Endpoints**

### GET /pms/organisation/:organisationId/pathology-submissions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `status?`, `pathologyType?`
- Controller: `PathologySubmissionController.list`

### POST /pms/organisation/:organisationId/pathology-submissions

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `pathologyType`, `sampleType`, `anatomicSite`, `collectedAt`, `submittedAt?`, `labName?`, `labRefNumber?`, `clinicalHistory?`, `differentials?`, `notes?`
- Controller: `PathologySubmissionController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/pathology-submissions/:submissionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `submissionId`
- Controller: `PathologySubmissionController.get`

### POST /pms/organisation/:organisationId/pathology-submissions/:submissionId/results

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `submissionId`
- Body fields: `results`, `diagnosis?`, `interpretation?`, `status?`
- Controller: `PathologySubmissionController.recordResults`

### POST /pms/organisation/:organisationId/pathology-submissions/:submissionId/review

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `submissionId`
- Body fields: `reviewNotes?`, `diagnosis?`, `interpretation?`
- Controller: `PathologySubmissionController.review`

### PUT /pms/organisation/:organisationId/pathology-submissions/:submissionId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `submissionId`
- Body fields: `submittedAt?`, `labName?`, `labRefNumber?`, `clinicalHistory?`, `differentials?`, `status?`, `notes?`
- Controller: `PathologySubmissionController.update`
