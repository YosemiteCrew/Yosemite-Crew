---
id: backend-api-medical-certificate
title: Medical Certificate API
slug: /apps/backend/api/medical-certificate
---

Manages medical certificates (health, vaccination, travel-fitness, export, boarding/breeding clearance, and other clinic-issued certificates) for a patient. All routes are called by the PIMS (Practice Information Management System, the clinic-facing web app) and are scoped to an organisation. A certificate moves through draft, issued, revoked, and expired states; issuing/revoking/expiring a certificate not in a valid starting state returns `409` with `{ message }`, and an unknown certificate returns `404` with `{ message }`.

**Endpoints**

### GET /pms/organisation/:organisationId/medical-certificates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Query: `patientId?`, `clientId?`, `status?`, `certificateType?`
- Controller: `MedicalCertificateController.list`

### POST /pms/organisation/:organisationId/medical-certificates

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`
- Body fields: `patientId`, `clientId`, `encounterId?`, `appointmentId?`, `certificateType`, `issuedBy?`, `validForTravel?`, `destinationCountry?`, `clinicalFindings?`, `restrictions?`, `notes?`
- Controller: `MedicalCertificateController.create`
- Response: `201`: JSON (created certificate), `400`: keys `errors` (Zod validation issues)

### GET /pms/organisation/:organisationId/medical-certificates/:certId

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `certId`
- Controller: `MedicalCertificateController.get`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/issue

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `certId`
- Body fields: `issuedBy`, `expiresAt?`, `clinicalFindings?`, `restrictions?`, `notes?`
- Controller: `MedicalCertificateController.issue`
- Response: `400`: keys `errors`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/revoke

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `certId`
- Body fields: `revokedBy`, `revokedReason?`
- Controller: `MedicalCertificateController.revoke`
- Response: `400`: keys `errors`

### POST /pms/organisation/:organisationId/medical-certificates/:certId/expire

- Auth: `requireWebAuth`
- RBAC: `withOrgPermissions, requirePermission`
- Params: `organisationId`, `certId`
- Controller: `MedicalCertificateController.expire`
