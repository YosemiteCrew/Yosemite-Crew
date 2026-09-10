---
id: backend-api-patient-allergy
title: Patient Allergy API
slug: /apps/backend/api/patient-allergy
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-allergies

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientAllergyController`

### POST /pms/organisation/:organisationId/patient-allergies

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientAllergyController`

### GET /pms/organisation/:organisationId/patient-allergies/:allergyId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientAllergyController`

### PUT /pms/organisation/:organisationId/patient-allergies/:allergyId

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientAllergyController`

### POST /pms/organisation/:organisationId/patient-allergies/:allergyId/resolve

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientAllergyController`
