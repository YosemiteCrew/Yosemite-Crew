---
id: backend-api-wound-assessment
title: Wound Assessment API
slug: /apps/backend/api/wound-assessment
---

Records and tracks wound assessments for a patient: location, measurements (length/width/depth), healing stage and status, exudate, wound bed/edges/periwound skin, and dressing, optionally linked to a surgical procedure or encounter. All routes are under the PIMS (Practice Information Management System, the clinic-facing web app) `/pms` namespace and require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/wound-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `surgicalProcedureId`, `from`, `to`
- Controller: `WoundAssessmentController.list`

### POST /pms/organisation/:organisationId/wound-assessments

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `encounterId`, `surgicalProcedureId`, `woundType`, `location`, `lengthCm`, `widthCm`, `depthCm`, `healingStage`, `healingStatus`, `exudateType`, `exudateAmount`, `odour`, `woundBed`, `woundEdges`, `periwoundSkin`, `dressing`, `dressingChangeFreq`, `assessedAt`, `notes`
- Controller: `WoundAssessmentController.record`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/wound-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `WoundAssessmentController.get`

### DELETE /pms/organisation/:organisationId/wound-assessments/:assessmentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `assessmentId`
- Controller: `WoundAssessmentController.delete`
- Response: `204`: no content
