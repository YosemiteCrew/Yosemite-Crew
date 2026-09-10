---
id: backend-api-patient-allergy
title: Patient Allergy API
slug: /apps/backend/api/patient-allergy
---

Manages a patient's allergy records for the PIMS (Practice Information Management System, the clinic-facing web app): allergen, type, severity, and reaction, with a dedicated action to mark an allergy resolved. All routes require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-allergies

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `status?`, `allergyType?`
- Controller: `PatientAllergyController.list`

### POST /pms/organisation/:organisationId/patient-allergies

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `allergen`, `allergyType`, `severity`, `reaction?`, `status?`, `onsetDate?`, `notes?`
- Controller: `PatientAllergyController.create`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/patient-allergies/:allergyId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `allergyId`
- Controller: `PatientAllergyController.get`

### PUT /pms/organisation/:organisationId/patient-allergies/:allergyId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `allergyId`
- Body fields: `allergen?`, `allergyType?`, `severity?`, `reaction?`, `status?`, `onsetDate?`, `resolvedDate?`, `notes?`
- Controller: `PatientAllergyController.update`

### POST /pms/organisation/:organisationId/patient-allergies/:allergyId/resolve

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `allergyId`
- Body fields: `resolvedDate?`
- Controller: `PatientAllergyController.resolve`
