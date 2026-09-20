---
id: backend-api-oncology-assessment
title: Oncology Assessment API
slug: /apps/backend/api/oncology-assessment
---

Manages oncology assessment records — tumour type, TNM staging (primary tumour/node/metastasis stage and overall stage), chemotherapy protocol/start date/cycle count, quality-of-life score, prognosis, and related diagnoses — for a patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation.

**Endpoints**

### GET /pms/organisation/:organisationId/oncology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `encounterId?`, `overallStage?`
- Controller: `OncologyAssessmentController.list`

### POST /pms/organisation/:organisationId/oncology-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId?`, `assessedAt`, `tumorType?`, `primaryTumorStage?`, `nodeStage?`, `metastasisStage?`, `overallStage?`, `chemotherapyProtocol?`, `chemotherapyStartDate?`, `chemotherapyCycles?`, `qualityOfLifeScore?`, `prognosis?`, `diagnoses?`, `notes?`
- Controller: `OncologyAssessmentController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `OncologyAssessmentController.get`

### PUT /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Body fields: `tumorType?`, `primaryTumorStage?`, `nodeStage?`, `metastasisStage?`, `overallStage?`, `chemotherapyProtocol?`, `chemotherapyStartDate?`, `chemotherapyCycles?`, `qualityOfLifeScore?`, `prognosis?`, `diagnoses?`, `notes?` (`patientId` and `assessedAt` are not updatable)
- Controller: `OncologyAssessmentController.update`

### DELETE /pms/organisation/:organisationId/oncology-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `OncologyAssessmentController.delete`
- Response: `204`: no content
