---
id: backend-api-patient-consent
title: Patient Consent API
slug: /apps/backend/api/patient-consent
---

Manages patient treatment consents for the PIMS (Practice Information Management System, the clinic-facing web app): granting a consent with an optional witness and expiry, listing an organisation's consents, and revoking one. `consentedBy` on grant is always the authenticated session's user id rather than a value the caller can set. All routes require organisation RBAC (role-based access control) permissions on `appointments`.

**Endpoints**

### GET /pms/organisation/:organisationId/patient-consents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `status?`, `consentType?`
- Controller: `PatientConsentController.list`

### POST /pms/organisation/:organisationId/patient-consents

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `consentType`, `procedureDesc?`, `consentedByName?`, `consentedAt?`, `expiresAt?`, `witnessedBy?`, `documentId?`, `notes?`
- Controller: `PatientConsentController.grant`
- Response: `201`: JSON

### GET /pms/organisation/:organisationId/patient-consents/:consentId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `consentId`
- Controller: `PatientConsentController.get`

### POST /pms/organisation/:organisationId/patient-consents/:consentId/revoke

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `consentId`
- Body fields: `revokedReason?`
- Controller: `PatientConsentController.revoke`
