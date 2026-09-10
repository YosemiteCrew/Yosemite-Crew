---
id: backend-api-patient-consent
title: Patient Consent API
slug: /apps/backend/api/patient-consent
---

PMS routes are called by the Practice Information Management System (clinic-facing web app) and require organisation RBAC permissions.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-consents

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientConsentController`

### POST /pms/organisation/:organisationId/patient-consents

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientConsentController`

### GET /pms/organisation/:organisationId/patient-consents/:consentId

- Auth: `requireWebAuth`
- Permission: `appointments:view:any`
- Controller: `PatientConsentController`

### POST /pms/organisation/:organisationId/patient-consents/:consentId/revoke

- Auth: `requireWebAuth`
- Permission: `appointments:edit:any`
- Controller: `PatientConsentController`
