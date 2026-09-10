---
id: backend-api-diagnostic-image
title: Diagnostic Image API
slug: /apps/backend/api/diagnostic-image
---

Manages diagnostic imaging studies (radiographs, ultrasound, CT, MRI, and similar) recorded against a patient's clinical record. Called by the PIMS (Practice Information Management System, the clinic-facing web app); every route requires organisation RBAC (role-based access control) permissions. Validation and not-found/conflict errors from the service layer come back as `{ message }`; a route-parameter failure returns `400` with `{ message: "Invalid route parameters" }`.

**Endpoints**

### GET /pms/organisation/:organisationId/diagnostic-images

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId`, `encounterId`, `imagingType`, `status`
- Controller: `DiagnosticImageController.list`

### POST /pms/organisation/:organisationId/diagnostic-images

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body: `RecordBodySchema`
- Body fields: `patientId`, `encounterId`, `imagingType` (`RADIOGRAPH`, `ULTRASOUND`, `CT_SCAN`, `MRI`, `ENDOSCOPY`, `FLUOROSCOPY`, `SCINTIGRAPHY`, `OTHER`), `bodyRegion`, `indication`, `takenAt`, `takenBy`, `interpretedBy`, `interpretedAt`, `findings`, `impression`, `followUpRequired`, `documentId`
- Controller: `DiagnosticImageController.record`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/diagnostic-images/:imageId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `imageId`
- Controller: `DiagnosticImageController.get`

### POST /pms/organisation/:organisationId/diagnostic-images/:imageId/review

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `imageId`
- Body: `ReviewBodySchema`
- Body fields: `interpretedBy`, `findings`, `impression`, `followUpRequired`, `status` (`PENDING_REVIEW`, `REVIEWED`, `REQUIRES_SPECIALIST`)
- Controller: `DiagnosticImageController.review`

### PUT /pms/organisation/:organisationId/diagnostic-images/:imageId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `imageId`
- Body: `UpdateBodySchema`
- Body fields: `bodyRegion`, `indication`, `takenBy`, `findings`, `impression`, `followUpRequired`, `documentId`, `status`
- Controller: `DiagnosticImageController.update`
